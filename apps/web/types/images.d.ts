/**
 * Static image imports (`import logo from "@/public/brand/safuney-logo.png"`).
 *
 * Next declares these types, but only through `next-env.d.ts`, which it regenerates on build and
 * which this repository gitignores. CI typechecks *before* it builds, so on a fresh checkout that
 * file does not exist yet and every image import fails to resolve. Referencing the same types from a
 * committed file makes the check independent of whether a build has run.
 */
/// <reference types="next/image-types/global" />
