# Contributing to Agora EU

We'd love your help building the future of European democracy! Here's how to get started.

## Ways to Contribute

### Code
- Fix bugs
- Add new features
- Improve performance
- Enhance documentation
- Improve UI/UX

### Content
- Translate discussions
- Write documentation
- Create tutorials
- Test and report bugs

### Ideas
- Suggest features
- Share feedback
- Identify problems
- Propose improvements

## Getting Started

### 1. Fork & Clone
```bash
git clone https://github.com/YOUR_USERNAME/agora-eu.git
cd agora-eu
```

### 2. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-name
```

### 3. Install & Run
```bash
npm install
cd client && npm install && cd ..
npm run dev
```

### 4. Make Your Changes

See our [Code Style Guide](#code-style) below.

### 5. Test
```bash
# Run tests (when available)
npm test

# Manual testing
# 1. Open http://localhost:3000
# 2. Test your feature
# 3. Check browser console for errors
```

### 6. Commit & Push
```bash
git add .
git commit -m "Add descriptive commit message"
git push origin feature/your-feature-name
```

### 7. Create a Pull Request

Go to GitHub and open a PR with:
- Clear description of changes
- Screenshots if UI-related
- Links to issues it fixes
- Notes on testing

## High-Priority Tasks

We'd especially love help with:

- [ ] **Machine Translation** - Add real-time translation for discussions
- [ ] **Real EU Data Integration** - Connect to official EU Parliament APIs
- [ ] **Mobile Optimization** - Improve mobile experience
- [ ] **User Authentication** - Add sign-up/login system
- [ ] **MEP Profiles** - Create detailed MEP voting records
- [ ] **Search & Filtering** - Advanced search capabilities
- [ ] **Email Notifications** - Alert users to new discussions
- [ ] **Dark Mode** - Add dark theme option
- [ ] **Accessibility** - Improve a11y (WCAG 2.1 AA)
- [ ] **Performance** - Database optimization, caching

## Code Style

### JavaScript/React

```javascript
// Use arrow functions
const MyComponent = () => {
  // Component code
};

// Use const by default
const value = 'hello';

// Use descriptive names
const userCount = 42; // Good
const uc = 42; // Bad

// Format: 2 spaces for indentation
function example() {
  if (true) {
    console.log('Hello');
  }
}

// Comments for complex logic only
// This calculates consensus percentage accounting for abstentions
const consensus = (yesCount / (yesCount + noCount)) * 100;
```

### CSS

```css
/* Use consistent naming */
.bill-card { }
.bill-card-title { }
.bill-card--active { } /* Modifier */

/* Organize by specificity */
.card {
  background: white;
  padding: 1rem;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
```

### SQL

```sql
-- Use uppercase for keywords
SELECT id, title, status
FROM bills
WHERE status = 'voting'
ORDER BY date_adopted DESC;

-- Use meaningful names
CREATE TABLE discussions (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER REFERENCES bills(id),
  content TEXT NOT NULL
);
```

## File Structure

### Adding a New Feature

1. **Create component** (if React):
   ```
   client/src/components/NewFeature.jsx
   client/src/components/NewFeature.css
   ```

2. **Add route** (if new page):
   ```javascript
   // In client/src/App.jsx
   <Route path="/new-feature" element={<NewFeature />} />
   ```

3. **Add API endpoint** (if backend):
   ```javascript
   // In server/index.js
   app.get('/api/new-feature', async (req, res) => {
     // Your code
   });
   ```

4. **Update database** (if needed):
   ```sql
   -- Add to server/schema.sql
   ALTER TABLE bills ADD COLUMN new_field VARCHAR(255);
   ```

## Git Commit Messages

Format:
```
[Type] Brief description

Longer explanation if needed.

- Bullet point for changes
- Another bullet
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `perf`: Performance

Examples:
```
feat: Add dark mode toggle

- Added theme context provider
- Created dark/light CSS variables
- Updated all components to use theme

fix: Correct voting chart display on mobile

- Increase chart height on small screens
- Adjust tooltip positioning
```

## Pull Request Guidelines

### Title Format
```
[Component/Feature] Brief description
```

Examples:
```
[BillDetail] Add print functionality
[API] Add voting consensus endpoint
[Docs] Update setup instructions
```

### Description Template
```markdown
## What?
Brief description of changes.

## Why?
Why are these changes needed?

## How?
How does it work?

## Testing
- [ ] Tested on desktop
- [ ] Tested on mobile
- [ ] No console errors
- [ ] Database schema updated (if applicable)

## Screenshots (if applicable)
[Add before/after screenshots]

## Related Issues
Fixes #123
```

## Review Process

1. Code review (we'll look at logic, style, performance)
2. Automated tests run
3. Approval needed before merge
4. Your contribution gets credited!

## Documentation

- Update README.md for major changes
- Add comments for complex logic
- Document new API endpoints
- Include setup instructions for new features

## Reporting Bugs

Use this format:

**Title**: Clear, specific description

**Steps to reproduce**:
1. Go to...
2. Click...
3. Observe...

**Expected**: What should happen?

**Actual**: What actually happened?

**Environment**:
- Browser: Chrome 120
- OS: macOS 14
- Node: 18.12.0

**Screenshots**: If applicable

## Feature Requests

**Title**: What feature do you want?

**Problem**: What problem does it solve?

**Solution**: How should it work?

**Alternatives**: Other ways to solve this?

## Community Guidelines

- Be respectful and inclusive
- No harassment or discrimination
- Assume good intent
- Ask for clarification if confused
- Welcome constructive feedback
- Help newer contributors

## Questions?

- Open an issue for questions
- Check existing issues first
- Join our discussions
- Email: nicola@nicolalorusso.ch

---

Thank you for helping build a more democratic Europe! 🇪🇺
