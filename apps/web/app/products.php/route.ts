import { NextResponse, type NextRequest } from "next/server";
import { legacyCategoryPath } from "@/lib/seo/legacy-urls";

/** The previous site's category pages, `products.php?a=<category name>`: a permanent redirect each. */
export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL(legacyCategoryPath(req.nextUrl.searchParams.get("a")), req.nextUrl.origin), 308);
}
