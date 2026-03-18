# Security Checks

## OWASP Top 10 Checklist

### 1. Injection (SQL, NoSQL, Command)
- [ ] All database queries use parameterized statements
- [ ] No string concatenation in queries
- [ ] Command execution uses safe APIs
- [ ] User input is sanitized before use

**Common patterns to avoid:**
```python
# Bad
query = f"SELECT * FROM users WHERE id = {user_input}"

# Good
cursor.execute("SELECT * FROM users WHERE id = ?", (user_input,))
```

### 2. Broken Authentication
- [ ] Passwords are hashed (bcrypt, argon2)
- [ ] Session IDs are random and long enough
- [ ] Multi-factor authentication available
- [ ] Account lockout after failed attempts

### 3. Sensitive Data Exposure
- [ ] HTTPS enforced everywhere
- [ ] Sensitive data encrypted at rest
- [ ] No secrets in code or config files
- [ ] Proper key management

### 4. XML External Entities (XXE)
- [ ] XML parsers disable external entities
- [ ] JSON used instead of XML where possible

### 5. Broken Access Control
- [ ] Authorization checks on every request
- [ ] No direct object references without checks
- [ ] Principle of least privilege applied

### 6. Security Misconfiguration
- [ ] Default credentials changed
- [ ] Unnecessary features disabled
- [ ] Error messages don't expose sensitive info
- [ ] Security headers configured

### 7. Cross-Site Scripting (XSS)
- [ ] Output encoding applied
- [ ] Content Security Policy (CSP) set
- [ ] Input validated and sanitized

**Example:**
```javascript
// Bad
element.innerHTML = userInput;

// Good
element.textContent = userInput;
```

### 8. Insecure Deserialization
- [ ] No untrusted data deserialization
- [ ] Integrity checks on serialized data
- [ ] Safe deserialization libraries used

### 9. Using Components with Known Vulnerabilities
- [ ] Dependencies regularly updated
- [ ] Vulnerability scanning in CI/CD
- [ ] Unused dependencies removed

### 10. Insufficient Logging & Monitoring
- [ ] Security events logged
- [ ] Logs protected from tampering
- [ ] Alerting for suspicious activity

## Language-Specific Checks

### JavaScript/TypeScript
- [ ] No `eval()` with user input
- [ ] No `innerHTML` with untrusted data
- [ ] `npm audit` run regularly

### Python
- [ ] No `pickle` with untrusted data
- [ ] No `exec()` or `eval()` with user input
- [ ] Virtual environment used

### Java
- [ ] No deserialization of untrusted objects
- [ ] Prepared statements used for SQL
- [ ] Security manager configured

## Secret Detection

Look for these patterns:
- API keys: `api_key`, `apiKey`, `API_KEY`
- Passwords: `password`, `passwd`, `pwd`
- Tokens: `token`, `auth`, `secret`
- Private keys: `private_key`, `privateKey`

**Tools:**
- Use `git-secrets` to prevent committing secrets
- Use `truffleHog` to scan repository history
