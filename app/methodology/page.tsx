import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Methodology - State Leg ZIPs",
  description:
    "How State Leg ZIPs maps ZIP codes to state legislative districts using U.S. Census Bureau relationship files and 2020 block populations.",
  alternates: {
    canonical: "/methodology",
  },
};

export default function Methodology() {
  return (
    <div className="h-screen flex flex-col px-4 py-8 max-w-3xl mx-auto overflow-hidden">
      <div className="shrink-0 mb-8">
        <Link
          href="/"
          className="text-slate-500 hover:text-blue-600 text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all duration-200"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to States
        </Link>
      </div>

      <main className="flex-1 min-h-0 overflow-auto">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-6">Methodology</h1>

        <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              Where the ZIP codes come from
            </h2>
            <p>
              All ZIP code data on this site comes from the{" "}
              <a
                href="https://www.census.gov/geographies/mapping-files/2024/dec/rdo/116-congressional-and-2024-state-legislative-district-background.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                U.S. Census Bureau&apos;s relationship files
              </a>
              , which map ZIP Code Tabulation Areas (ZCTAs) to state legislative
              districts.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              What is a ZCTA?
            </h2>
            <p>
              A ZCTA (ZIP Code Tabulation Area) is the Census Bureau&apos;s
              approximation of a USPS ZIP code delivery area. ZCTAs are built
              from census blocks and are designed to closely match ZIP code
              boundaries. For practical purposes like ad targeting, ZCTAs and ZIP
              codes are interchangeable.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              How districts are matched to ZIP codes
            </h2>
            <p>
              The Census Bureau publishes files that show where legislative
              districts and ZCTAs overlap geographically. Any ZIP code that
              touches a district is a candidate for that district, so a single
              ZIP code can appear in multiple districts when it straddles a
              boundary.
            </p>
            <p className="mt-2">
              Touching a district isn&apos;t the same as being worth paying to
              reach. Many ZIP codes only clip a district&apos;s edge, and some
              along state lines are almost entirely in another state. So for
              each ZIP code we count how many of its residents actually live in
              the district, using 2020 Census block populations.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              Default list and spillover ZIPs
            </h2>
            <p>
              By default, clicking a district copies the ZIP codes where{" "}
              <strong>at least 5% of the ZIP&apos;s residents live in the
              district</strong>. Across all districts, this keeps 99.4% of
              district residents in the copied ZIPs and raises the share of
              people reached who actually live in the district from 47% to 61%.
            </p>
            <p className="mt-2">
              The rest are <strong>spillover ZIPs</strong>: ZIP codes that touch
              the district but have under 5% of their residents in it, or have
              no residents at all. Turn on <em>Include spillover ZIPs</em> to
              copy every ZIP code that touches the district, as the site did
              before October 2026. The setting is remembered in your browser.
            </p>
            <p className="mt-2">
              A few ZIP codes that pass the 5% rule have most of their residents
              in another state, such as Fort Campbell&apos;s 42223, which is
              mostly in Kentucky but over a third inside Tennessee House District
              75. We keep these in the list and mark the district with an amber
              dot. The copy confirmation names the ZIP and its state.
            </p>
            <p className="mt-2">
              The confirmation also shows how many spillover ZIPs were left out
              and what share of the district&apos;s residents the copied ZIPs
              reach.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              How residents are counted
            </h2>
            <p>
              Every 2020 census block belongs to at most one ZCTA and, in the
              Census Bureau&apos;s 2024 block equivalency files, to exactly one
              legislative district. Adding up block populations gives the exact
              number of a ZIP&apos;s residents inside each district and each
              state. Summed by district, these totals match the Census
              Bureau&apos;s published 2024 district populations exactly for all
              but two of more than 6,800 districts.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              Data vintage
            </h2>
            <p>
              The current data uses <strong>2024 state legislative district boundaries</strong>{" "}
              and <strong>2020 ZCTA boundaries</strong>, as published by the
              Census Bureau. District boundaries reflect the latest redistricting
              cycle.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              Limitations
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                ZCTAs are approximations of USPS ZIP codes, not exact matches.
                Some ZIP codes used for PO boxes or unique delivery routes may
                not have a corresponding ZCTA.
              </li>
              <li>
                Boundary overlaps mean some ZIP codes appear in multiple
                districts. This is by design for ad targeting but may not be
                appropriate for every use case.
              </li>
              <li>
                Resident shares use the 2020 Census count. They don&apos;t
                reflect population change since 2020, or how each ad platform
                maps its users to ZIP codes.
              </li>
              <li>
                Data is as current as the Census Bureau&apos;s latest release.
                If a state redistricts mid-decade, there may be a lag before
                updated data is available.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              Source files
            </h2>
            <p>The raw Census Bureau files used:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                <strong>House districts:</strong>{" "}
                <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                  tab20_sldl202420_zcta520_natl.txt
                </code>
              </li>
              <li>
                <strong>Senate districts:</strong>{" "}
                <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                  tab20_sldu202420_zcta520_natl.txt
                </code>
              </li>
              <li>
                <strong>Blocks to ZCTAs:</strong>{" "}
                <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                  tab20_zcta520_tabblock20_natl.txt
                </code>
              </li>
              <li>
                <strong>Blocks to 2024 districts:</strong>{" "}
                <a
                  href="https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/2024-state-legislative-bef/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  2024 state legislative block equivalency files
                </a>
              </li>
              <li>
                <strong>Block populations:</strong>{" "}
                <a
                  href="https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  2020 Census redistricting data (PL 94-171)
                </a>
              </li>
            </ul>
            <p className="mt-2">
              The relationship files are available from the{" "}
              <a
                href="https://www2.census.gov/geo/docs/maps-data/data/rel2020/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                Census Bureau&apos;s geographic relationship files page
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="shrink-0 pt-4 pb-4 text-center border-t border-slate-200">
        <p className="text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-600 hover:underline transition-colors duration-200">
            State Leg ZIPs
          </Link>
        </p>
      </footer>
    </div>
  );
}
