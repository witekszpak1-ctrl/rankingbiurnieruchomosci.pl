"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin, logout } from "@/lib/admin-auth";
import { getFirm } from "@/lib/admin-data";
import { writeAudit } from "@/lib/audit";
import { query, withTransaction } from "@/lib/db";
import { evaluateGate } from "@/lib/gate";
import { slugify, uniqueSlug } from "@/lib/slug";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(path: string, kind: "ok" | "error", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

/** Publikacja, wycofanie i odrzucenie wpisu. Każda zmiana zapisuje wpis audytu w tej samej transakcji. */
export async function listingAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  const force = formData.get("force") === "on";
  if (!UUID_RE.test(id)) back("/admin/firms", "error", "Nieprawidłowy identyfikator wpisu.");
  const detail = await getFirm(id);
  if (!detail) back("/admin/firms", "error", "Nie znaleziono wpisu.");
  const path = `/admin/firms/${id}`;
  const { listing } = detail;

  let finalSlug = listing.slug;
  if (action === "publish") {
    if (["rejected", "removed"].includes(listing.status)) {
      back(path, "error", "Wpis odrzucony lub usunięty nie może zostać opublikowany.");
    }
    const gate = evaluateGate(detail.gate);
    if (!gate.ok && !force) back(path, "error", `Bramka publikacji: ${gate.reasons.join(" ")}`);
    await withTransaction(async (client) => {
      if (!finalSlug) {
        const taken = await client.query<{ slug: string }>(
          `select slug from listings
           where vertical_id = (select vertical_id from listings where id = $1)
             and city_id = (select city_id from listings where id = $1) and slug is not null`,
          [id],
        );
        finalSlug = uniqueSlug(slugify(detail.brandName), taken.rows.map((r) => r.slug));
      }
      await client.query(
        `update listings set status = 'published', slug = $2, noindex = false, published_at = coalesce(published_at, now())
         where id = $1`,
        [id, finalSlug],
      );
      if (detail.description && detail.description.status === "validated") {
        await client.query("update descriptions set status = 'published' where id = $1", [detail.description.id]);
      }
      await writeAudit(client, {
        actor: admin,
        action: "listing.publish",
        entityType: "listing",
        entityId: id,
        before: { status: listing.status, slug: listing.slug },
        after: { status: "published", slug: finalSlug, forced: force && !gate.ok, gate: gate.reasons },
      });
    });
  } else if (action === "unpublish" || action === "reject") {
    const next = action === "unpublish" ? "verified" : "rejected";
    await withTransaction(async (client) => {
      await client.query("update listings set status = $2, noindex = true where id = $1", [id, next]);
      await writeAudit(client, {
        actor: admin,
        action: `listing.${action}`,
        entityType: "listing",
        entityId: id,
        before: { status: listing.status },
        after: { status: next },
      });
    });
  } else {
    back(path, "error", "Nieznana akcja.");
  }

  revalidatePath("/");
  revalidatePath(`/${detail.city.slug}`);
  if (finalSlug) revalidatePath(`/${detail.city.slug}/${finalSlug}`);
  revalidatePath("/sitemap.xml");
  const done = { publish: "Wpis opublikowany.", unpublish: "Wpis wycofany z publikacji.", reject: "Wpis odrzucony." }[action];
  back(path, "ok", done ?? "Zapisano.");
}

/** Ręczna decyzja w kolejce weryfikacji: zatwierdź albo odrzuć domenę (i powiązane wpisy). */
export async function reviewAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!UUID_RE.test(id) || !["approve", "reject"].includes(decision)) {
    back("/admin/review", "error", "Nieprawidłowe dane formularza.");
  }
  const rows = await query<{ verificationStatus: string; brandId: string | null }>(
    `select verification_status as "verificationStatus", brand_id as "brandId" from domains where id = $1`,
    [id],
  );
  const domain = rows[0];
  if (!domain) back("/admin/review", "error", "Nie znaleziono domeny.");

  const approve = decision === "approve";
  await withTransaction(async (client) => {
    await client.query(
      `update domains set verification_status = $2,
         verification_reasons = verification_reasons || to_jsonb($3::text) where id = $1`,
      [id, approve ? "verified" : "rejected", `Decyzja ręczna (${approve ? "zatwierdzenie" : "odrzucenie"}): ${admin}`],
    );
    if (domain.brandId) {
      await client.query(
        `update listings set status = $2 where brand_id = $1 and status in ('needs_review', 'candidate'${approve ? "" : ", 'verified'"})`,
        [domain.brandId, approve ? "verified" : "rejected"],
      );
    }
    await writeAudit(client, {
      actor: admin,
      action: approve ? "domain.approve" : "domain.reject",
      entityType: "domain",
      entityId: id,
      before: { status: domain.verificationStatus },
      after: { status: approve ? "verified" : "rejected" },
    });
  });
  back("/admin/review", "ok", approve ? "Domena zatwierdzona." : "Domena odrzucona.");
}
