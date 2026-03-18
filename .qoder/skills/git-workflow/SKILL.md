---
name: git-workflow
description: Automate Git operations including commits, branches, pull requests, and merges. Use when the user needs help with Git commands, branching strategies, or commit message formatting.
---

# Git Workflow

## Quick Start

Common Git operations with best practices:

### Commit Changes
```
/review-pr     - Review staged changes before commit
/commit        - Create a well-formatted commit
```

### Branch Management
```
git checkout -b feature/user-authentication
git push -u origin feature/user-authentication
```

### Pull Requests
```
gh pr create --title "Add user authentication" --body "Description..."
```

## Commit Message Format

Follow the **Conventional Commits** specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, semicolons)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvement

### Examples

**Feature:**
```
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware.
Users can now authenticate via JWT tokens.

Closes #123
```

**Bug fix:**
```
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation.
Previously, dates were displayed in server timezone instead of user timezone.

Fixes #456
```

**Breaking change:**
```
feat(api)!: change user endpoint response format

BREAKING CHANGE: The /api/user endpoint now returns user object
directly instead of wrapping in {data: {...}}.

Migration guide: Update clients to expect new format.
```

## Branching Strategy

### Branch Naming
```
feature/user-authentication    # New feature
bugfix/login-error            # Bug fix
hotfix/security-patch         # Critical production fix
release/v1.2.0               # Release preparation
```

### Workflow
1. **Create branch** from main/master
2. **Make changes** with logical commits
3. **Push branch** to remote
4. **Create PR** for review
5. **Merge** after approval
6. **Delete** feature branch

## Pull Request Guidelines

### PR Title
- Use conventional commit format
- Be concise and descriptive

### PR Description Template
```markdown
## Summary
- Brief description of changes
- Why these changes are needed

## Changes
- List of main changes
- Files/components affected

## Testing
- How to test these changes
- Test coverage added

## Screenshots (if applicable)
Before/After screenshots for UI changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Common Operations

### Undo Last Commit (not pushed)
```bash
git reset --soft HEAD~1
```

### Amend Last Commit Message
```bash
git commit --amend -m "New message"
```

### Interactive Rebase (last 3 commits)
```bash
git rebase -i HEAD~3
```

### Cherry-pick Commit
```bash
git cherry-pick <commit-hash>
```

### Stash Changes
```bash
git stash save "Work in progress on feature X"
git stash pop
```

## Best Practices

### Do's
- Write clear, descriptive commit messages
- Keep commits atomic (one logical change per commit)
- Pull latest changes before starting work
- Use branches for features/fixes
- Review your own changes before committing

### Don'ts
- Don't commit directly to main/master
- Don't include unrelated changes in one commit
- Don't commit sensitive information
- Don't force push to shared branches
- Don't rewrite public history

## Merge vs Rebase

### Use Merge When:
- Integrating shared/remote branches
- Preserving complete history
- Working with less experienced team members

### Use Rebase When:
- Cleaning up local feature branch
- Maintaining linear history
- Updating feature branch with latest main

```bash
# Merge
git checkout main
git merge feature/user-auth

# Rebase
git checkout feature/user-auth
git rebase main
```

## Conflict Resolution

1. **Identify conflicts**
   ```bash
   git status
   ```

2. **Edit conflicting files**
   Look for markers:
   ```
   <<<<<<< HEAD
   Your changes
   =======
   Their changes
   >>>>>>> branch-name
   ```

3. **Stage resolved files**
   ```bash
   git add <resolved-file>
   ```

4. **Continue**
   ```bash
   git rebase --continue  # if rebasing
   git commit             # if merging
   ```
