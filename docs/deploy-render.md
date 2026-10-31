# Putting RoboRoute online with Render

This publishes RoboRoute as a website anyone can open, with nothing to install. It uses the
`render.yaml` file at the root of the repository, so there are no settings to type in by hand.
Allow about 20 minutes, most of it waiting for the first build.

You need: the repository on GitHub with `render.yaml` on the `main` branch, and a GitHub account
with access to it.

## Before you start: choose the region

Render runs the site in one region, and **the region cannot be changed later** (only by creating
the service again). `render.yaml` says `region: oregon` (US west). If most of your users are
elsewhere, change that line before step 3 to the closest of `oregon`, `ohio`, `virginia`,
`frankfurt` (Europe) or `singapore` (Asia), then commit and push.

## Steps

1. **Create an account.** Go to <https://render.com> and choose *Sign up with GitHub*.
2. **Let Render see the repository.** When Render asks for access to GitHub, choose
   *Only select repositories* and pick `SEMO-EL/ROBOROUTE`. (If it does not ask now, it will in
   the next step.)
3. **Create the service from the blueprint.** In the Render dashboard click **New** →
   **Blueprint**, select the repository, and give the blueprint a name (e.g. `roboroute`). Render
   reads `render.yaml` and shows one web service, `roboroute`, on the *Free* plan. Click
   **Apply** (or **Deploy Blueprint**).
4. **Wait for the first build** (about 5–10 minutes). Open the `roboroute` service and its
   **Logs**; the build is finished when the status says **Live**.
5. **Open the site.** The address is at the top of the service page, something like
   `https://roboroute.onrender.com` (Render adds a few characters if the name is taken). Load an
   example scenario, press *Optimise* on the Strategy page and run a simulation to check it works.

That is all. Share the address with your team.

## Afterwards

- **Updates are automatic.** Every push to `main` is deployed once its GitHub checks (CI) pass;
  a change that fails the tests is never deployed.
- **The free plan sleeps** after about 15 minutes without visitors; the next visitor waits up to
  about a minute while it wakes. To keep it always on, open the service's **Settings** →
  **Instance type** and choose a paid type (also change `plan: free` to `plan: starter` in
  `render.yaml` so the file matches).
- **Limits for a public site** are set in `render.yaml`: 60 calculations per minute per visitor
  address (a classroom often shares one address) and 2 calculations at a time; others wait up to
  30 seconds. Change the values there and push.
- **Your users' data** stays in their own browsers. The server stores nothing, so there is
  nothing to back up.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| Render rejects the blueprint and names a field | Copy the message; the field may have been renamed by Render. Removing the line it names is usually safe (the only one with an effect is `autoDeployTrigger`, which makes deploys wait for CI). |
| The build fails | Open the build logs, copy the last red lines. |
| "Too many calculations from your network" | The per-minute limit was reached; raise `ROBOROUTE_RATE_LIMIT_PER_MINUTE`. |
| "The server is busy" | Too many simulations at once for the free plan; raise `ROBOROUTE_MAX_CONCURRENT_JOBS` slightly or choose a larger instance type. |
| The page takes a minute to load | The free instance was asleep; this is expected. |
