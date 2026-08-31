# 🐙 Git Workflow Guide: Best Practices for `git add`, `commit`, `pull`, `push`, and `checkout`

This guide explains the correct, safe, and professional workflow for using Git in team development environments like **Seafudz ng Bayan**.

---

## 📌 Quick Summary Flow

```
 1. Check Status ➔ 2. Pull Latest ➔ 3. New Branch ➔ 4. Stage Changes ➔ 5. Commit ➔ 6. Pull & Rebase ➔ 7. Push
   (git status)     (git pull)   (git checkout -b)   (git add .)     (git commit)    (git pull)     (git push)
```

---

## 1️⃣ `git status` — Always Check Before Acting

Before running any Git command, inspect what state your working directory is in.

```bash
git status
```

### Why it matters:
* Shows modified files, staged files, and untracked files.
* Prevents accidentally staging unwanted temporary files, secrets (`.env`), or build outputs.

---

## 2️⃣ `git pull` — Get the Latest Remote Code FIRST

**Golden Rule:** Always pull before you start writing code and right before pushing.

```bash
# Pull changes from current tracking branch
git pull

# Recommended for clean linear commit history (avoids merge commits)
git pull --rebase origin main
```

### Why it matters:
* Prevents merge conflicts before they happen.
* Ensures you are building on top of the latest team updates.

---

## 3️⃣ `git checkout -b` — Creating & Switching Branches

The `git checkout -b <branch-name>` command creates a brand new local branch and immediately switches your workspace to it.

```bash
# Create and switch to a new feature branch
git checkout -b feature/order-receipt-modal

# Modern alternative equivalent syntax
git switch -c feature/order-receipt-modal
```

### 🏷️ Naming Conventions for Branches:
* `feature/name`: For new functionality (`feature/pos-discount-system`)
* `fix/name`: For bug fixes (`fix/kitchen-timer-delay`)
* `refactor/name`: For code cleanup/restructuring (`refactor/sales-query-optimization`)
* `docs/name`: For documentation updates (`docs/git-workflow-guide`)

### 💡 Branch Switching Tips:
```bash
# Switch to an existing branch
git checkout main
# or
git switch main

# List all local branches (and see which branch you are currently on)
git branch

# Push your new branch to remote GitHub repository for the first time
git push -u origin feature/order-receipt-modal
```

---

## 4️⃣ `git add .` — Staging Your Changes Responsibly

`git add .` stages **all** modified and new untracked files in the current directory and subdirectories.

```bash
# Stage ALL modified and untracked files
git add .

# Stage specific files (Safer for targeted commits)
git add Frontend/src/features/Dashboard.tsx
```

### ⚠️ When `git add .` is Good vs. Dangerous:

| Scenario | Recommended Command | Reason |
| :--- | :--- | :--- |
| **All modified files belong to the same feature** | `git add .` | Quick and staging everything intentional |
| **Untracked files might contain `.env` or temporary files** | `git status` first, then `git add .` | Prevents leaking API keys or secrets |
| **Only wanted to commit 1 bug fix out of 3 edited files** | `git add <file-path>` | Keeps commits clean and isolated |

> 💡 **Tip:** Ensure your `.gitignore` file includes `node_modules/`, `.env`, build outputs (`dist/`, `build/`), and IDE configurations.

---

## 5️⃣ `git commit` — Saving Staged Snapshots

A commit records the staged changes with a descriptive message explaining **what** and **why**.

```bash
# Good commit format with clear descriptive message
git commit -m "feat(dashboard): add responsive navigation bar and ocean bubbles animation"
```

### ✍️ Conventional Commit Message Structure:
Use clear prefixes so team members understand your changes at a glance:

* `feat:` New feature (`feat(pos): add receipt preview modal`)
* `fix:` Bug fix (`fix(auth): fix token refresh error on page reload`)
* `docs:` Documentation change (`docs: update setup instructions in README`)
* `style:` Formatting, missing semi-colons, styling updates
* `refactor:` Code restructuring without feature/bug changes
* `chore:` Build scripts, dependency updates (`chore: update npm packages`)

---

## 6️⃣ `git pull` — Check Again Before Pushing

Before pushing your commit to GitHub, pull once more to make sure teammates haven't pushed changes while you were working.

```bash
git pull origin main
```

If conflicts occur:
1. Open the conflicting files highlighted by Git.
2. Resolve conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
3. Stage resolved files: `git add .`
4. Continue merge or rebase: `git commit` or `git rebase --continue`.

---

## 7️⃣ `git push` — Publishing Changes to Remote Repository

Once your commits are clean and local code is up to date, send your changes to the remote repository.

```bash
# Push to current branch
git push

# Push new branch for the first time
git push -u origin feature/your-feature-name
```

---

## 🔄 Recommended Daily Developer Workflow Routine

Follow this step-by-step procedure whenever you work on a task:

1. **Start of Workday / Task:**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create a Feature Branch (Optional but recommended):**
   ```bash
   git checkout -b feature/order-tracking
   ```

3. **After completing a chunk of work:**
   ```bash
   git status                     # Verify changes
   git add .                      # Stage changes
   git commit -m "feat: description of work"
   ```

4. **Before Pushing:**
   ```bash
   git pull origin main           # Bring in any new team changes
   git push origin feature/order-tracking
   ```

---

## ⛔ Top 5 Git Mistakes to Avoid

1. ❌ **Never run `git add .` without checking `git status` first.**
2. ❌ **Never commit sensitive files** (`.env`, secrets, passwords, private keys).
3. ❌ **Never use vague commit messages** like `"fix"`, `"update"`, `"asdf"`, or `"wip"`.
4. ❌ **Never push broken code that doesn't compile or run.**
5. ❌ **Never force push (`git push --force`) to shared branches (`main` / `master`).**
