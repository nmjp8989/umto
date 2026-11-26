# Little Panth private MP4 render studio

This Worker is an owner-only proxy of the Little Panth catalogue with a same-origin authenticated GitHub Actions dispatch endpoint. The public GitHub Pages catalogue continues to work unchanged and retains the manual workflow fallback. No GitHub credential is sent to the browser, saved in browser storage, or committed to the repository.

## One-time setup

1. In GitHub, create an expiring **fine-grained personal access token** for only the nmjp8989/umto repository, with repository permission **Actions: Read and write**. Leave other optional permissions disabled. Save the token privately; do not put it in a commit or share it in chat.
2. Deploy this directory as a Cloudflare Worker named little-panth-render. With Wrangler installed and authenticated, run npx wrangler deploy from this directory. Alternatively, create a Worker from the dashboard and paste worker.mjs into its editor.
3. In Cloudflare Workers & Pages, open the new Worker, enable **Cloudflare Access** for all traffic, and allow only the owner's verified email in the Access policy. Zero Trust setup is required. Do not use a public/bypass rule. The Worker intentionally returns 403 until authenticated and configured.
4. In the Worker's Settings > Variables and Secrets, set OWNER_EMAIL to the exact authorized email, ACCESS_AUD to the Access application's audience tag, and GITHUB_TOKEN as a **Secret**. Never place the token in wrangler.toml.
5. Open the Worker's production URL and sign in through Access. Bookmark that private URL for production work. Use the same catalogue, select approved stories, enter a name, and click Generate MP4. The status and link to the GitHub run appear automatically. No JSON or workflow interaction is needed to start it.

Approvals that have already been saved to the repository are shared across both sites. Unsynced approvals and browser recordings on the public GitHub Pages origin are local to that origin: sync them once from the public catalogue before switching, or re-confirm the decisions in the private studio. The Worker itself does not silently import or change approvals.

The renderer uses the existing validated production request and existing workflow. Only successful exports are recorded. Use the GitHub run link to download the named ZIP artifact containing the MP4 and chapter timestamps. The API is restricted to this workflow and requires authenticated owner context for every request; no CORS access is granted. The private studio polls run status while open and GitHub continues processing after the tab closes. The site does not automatically dispatch on page load. Check existing Actions runs before retrying an ambiguous network failure.

Reference documentation:
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://docs.github.com/en/rest/actions/workflows?apiVersion=2026-03-10
