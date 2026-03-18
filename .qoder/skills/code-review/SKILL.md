---
name: code-review
description: Review code for quality, security, and maintainability following team standards. Use when reviewing pull requests, examining code changes, or when the user asks for a code review.
---

# Code Review

## Quick Start

When reviewing code, follow this systematic approach:

1. **Understand the context** - Read the PR description or commit message
2. **Check correctness** - Identify bugs, logic errors, edge cases
3. **Verify security** - Look for common vulnerabilities
4. **Assess style** - Ensure code follows conventions
5. **Evaluate tests** - Check test coverage and quality

## Review Checklist

### Correctness & Bugs
- [ ] Logic is correct and handles edge cases
- [ ] No off-by-one errors or incorrect conditions
- [ ] Null/undefined values handled appropriately
- [ ] Error handling is comprehensive
- [ ] No memory leaks or resource leaks

### Security
- [ ] No SQL injection vulnerabilities
- [ ] No XSS (Cross-Site Scripting) issues
- [ ] Input validation is thorough
- [ ] No hardcoded secrets or credentials
- [ ] Proper authentication and authorization checks

### Code Style
- [ ] Functions are appropriately sized (< 50 lines)
- [ ] Naming is clear and descriptive
- [ ] No deeply nested code (> 3 levels)
- [ ] Code is DRY (Don't Repeat Yourself)
- [ ] Comments explain "why", not "what"

### Testing
- [ ] Unit tests cover new functionality
- [ ] Edge cases are tested
- [ ] Tests are meaningful (not just coverage)
- [ ] Test names describe the scenario

## Providing Feedback

Use this format for clarity:

**Critical** 🔴
Issues that must be fixed before merge (bugs, security vulnerabilities)

**Suggestion** 🟡
Recommended improvements (performance, readability)

**Nice to have** 🟢
Optional enhancements (refactoring opportunities)

## Example Review

```markdown
## Code Review Summary

### Critical 🔴
1. **Line 45**: SQL injection vulnerability
   - Use parameterized queries instead of string concatenation
   ```python
   # Bad
   cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

   # Good
   cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
   ```

### Suggestion 🟡
1. **Line 23**: Function `processData` is too long (85 lines)
   - Consider breaking into smaller functions

### Nice to have 🟢
1. **Line 12**: Could use more descriptive variable name
   - `x` → `userCount`
```

## Additional Resources

- For detailed security checks, see [SECURITY_CHECKS.md](SECURITY_CHECKS.md)
- For code style guidelines, see [STYLE_GUIDE.md](STYLE_GUIDE.md)
