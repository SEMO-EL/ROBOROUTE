# Putting RoboRoute online with Hugging Face Spaces

This publishes RoboRoute as a free website anyone can open, with nothing to install. Hugging Face
Spaces run Docker apps on free hardware, and an account needs only an email address, with no
card or bank details. Allow about 20 minutes, most of it waiting for the first build.

How it works: after CI passes on `main`, the GitHub Action
`.github/workflows/deploy-space.yml` copies what the app needs into your Space
(`scripts/assemble-space.sh`), and Hugging Face builds and runs it.

## Steps

1. **Create a Hugging Face account** at <https://huggingface.co/join> and confirm your email
   address. Note your **username**, shown in the top-right menu.

2. **Create the Space.** Go to <https://huggingface.co/new-space> and fill in:
   - **Space name:** `roboroute`
   - **License:** MIT
   - **SDK:** **Docker**, template **Blank**
   - **Hardware:** **CPU basic · free**
   - **Visibility:** Public

   Click **Create Space**. It stays empty until step 5.

3. **Create an access token** so GitHub may update the Space. Click your profile picture →
   **Settings** → **Access Tokens** → **Create new token**. Choose the token type **Write**,
   name it `roboroute-deploy`, create it, and **copy it now**; it is shown only once.

4. **Give GitHub the token and the Space name.** On GitHub, open the repository →
   **Settings** → **Secrets and variables** → **Actions**:
   - **Secrets** tab → **New repository secret**: name `HF_TOKEN`, value: the token.
   - **Variables** tab → **New repository variable**: name `HF_SPACE`, value:
     `your-username/roboroute` (with your Hugging Face username).

5. **Deploy.** Either push to `main`, or on GitHub go to **Actions** → **Deploy to Hugging Face
   Space** → **Run workflow**. When the workflow is green, open your Space: it shows
   **Building** (about 5–10 minutes the first time), then **Running**.

6. **Open the site.** Two addresses work:
   - `https://huggingface.co/spaces/your-username/roboroute`: the app inside Hugging Face's page.
   - `https://your-username-roboroute.hf.space`: the app on its own, full window. This is the one
     to share.

   Load an example scenario, press *Optimise* on the Strategy page and run a simulation to check
   it works.

## Afterwards

- **Updates are automatic:** every push to `main` that passes CI is deployed. Do not edit files
  in the Space directly; each deployment replaces them.
- **Sleeping:** a free Space that nobody visits for a while goes to sleep; the next visitor waits
  a minute or two while it wakes. Paid hardware stays awake.
- **Limits for a public site** (in `scripts/assemble-space.sh`): 60 calculations per minute per
  visitor address (a classroom often shares one) and 2 calculations at a time; others wait up to
  30 seconds.
- **Your users' data** stays in their own browsers; the server stores nothing.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| The deploy workflow does not run at all | Check that the variable `HF_SPACE` exists (step 4) and that CI passed on `main`. |
| The deploy workflow fails with "HF_TOKEN secret is missing" | Add the secret (step 4); the name must be exactly `HF_TOKEN`. |
| It fails with 401, 403 or "not found" | The token is not a **Write** token, or `HF_SPACE` does not match `username/space-name` exactly. |
| The Space shows "Build error" or "Runtime error" | Open the Space's **Logs** and copy the last red lines. |
| "Too many calculations from your network" | The per-minute limit was reached; raise it in `scripts/assemble-space.sh`. |
