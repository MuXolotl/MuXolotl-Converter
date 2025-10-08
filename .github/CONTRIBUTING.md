# Contributing to MuXolotl-Converter

First off, thank you for considering contributing to MuXolotl-Converter! 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

Be respectful, inclusive, and considerate. We're all here to make this project better!

## How Can I Contribute?

### Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.yml) and include:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- System information
- Screenshots/logs

### Suggesting Features

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.yml) and describe:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### Code Contributions

1. **Find an issue** to work on or create one
2. **Comment** on the issue to let others know you're working on it
3. **Fork** the repository
4. **Create a branch** (`git checkout -b feature/amazing-feature`)
5. **Make your changes** following our coding guidelines
6. **Test thoroughly** on at least one platform
7. **Commit** with clear messages
8. **Push** to your fork
9. **Open a Pull Request** using the template

## Development Setup

See [Building from Source](../README.md#-building-from-source) in the README.

### Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/MuXolotl-Converter.git
cd MuXolotl-Converter
npm install
npm run dev
```

## Coding Guidelines

### TypeScript/React (Frontend)

- **Use TypeScript** - no `any` types unless absolutely necessary
- **Functional components** with hooks (no class components)
- **React.memo()** for performance-critical components
- **useCallback/useMemo** to prevent unnecessary re-renders
- **Named exports** for components
- **Proper typing** for props and state

**Example:**
```typescript
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ title, onAction }) => {
  // Component logic
};

export default React.memo(MyComponent);
```

### Rust (Backend)

- **Follow Rust conventions** (`rustfmt`, `clippy`)
- **Error handling** with `Result<T, E>` and `anyhow`
- **Async/await** for I/O operations
- **Documentation comments** for public functions
- **Unit tests** for critical logic

**Example:**
```rust
/// Converts audio file to specified format
pub async fn convert_audio(
    input: &str,
    output: &str,
    format: &str,
) -> Result<String> {
    // Implementation
}
```

### CSS/Styling

- **Tailwind CSS** utility classes preferred
- **Glass morphism** for UI elements (use `.glass` class)
- **Responsive design** (test on different window sizes)
- **Animations** with Framer Motion

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(converter): add support for AV1 codec
fix(ui): correct progress bar percentage display
docs(readme): update installation instructions
```

## Pull Request Process

1. **Update documentation** if you changed functionality
2. **Add/update tests** if applicable
3. **Ensure all checks pass** (linting, building)
4. **Test on at least one platform** (Windows/macOS/Linux)
5. **Fill out PR template** completely
6. **Link related issues** (`Fixes #123`)
7. **Request review** from maintainers
8. **Address feedback** promptly

### PR Review Checklist

Your PR should:
- [ ] Build successfully
- [ ] Pass all tests
- [ ] Follow coding guidelines
- [ ] Include necessary documentation
- [ ] Have no merge conflicts
- [ ] Be tested on at least one platform

## Questions?

- 💬 [GitHub Discussions](https://github.com/MuXolotl/MuXolotl-Converter/discussions)
- 🐛 [GitHub Issues](https://github.com/MuXolotl/MuXolotl-Converter/issues)

Thank you for contributing! 🦎💜
```