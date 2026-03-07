# Contributing to Sahl Stock Analyzer

Thank you for contributing.

This project follows a structured development workflow to ensure stability of the production system.

## Branch Strategy

The repository uses the following branch structure:

`main`
Production branch connected to Vercel. Only the maintainer merges changes here.

`staging`
Default development branch. All contributor pull requests must target this branch.

`feature/*`
Temporary branches used for development of individual features.

## Contribution Workflow

1. Fork the repository
2. Create a feature branch

`git checkout -b feature/your-feature-name`

3. Make your changes
4. Commit your changes

`git commit -m "Add feature: short description"`

5. Push your branch

`git push origin feature/your-feature-name`

6. Open a Pull Request to the **`staging`** branch

## Important Rules

Pull requests must target **staging**, not main.

The **`main` branch is reserved for production deployments**.

Only the repository maintainer merges changes from staging into main.

## Code Standards

Keep functions small and modular.

Write clear commit messages.

Avoid breaking existing APIs.

Add documentation when introducing new modules.

## Testing

Before submitting a PR:

Ensure the project builds successfully.

Test the feature locally.

Ensure no existing functionality breaks.

## Issues

If you find a bug or want to propose a feature, open a GitHub Issue before starting development.

Include:

Description of the problem
Steps to reproduce
Expected behavior

## Pull Request Review

Pull requests may receive feedback from maintainers.

Please address review comments before the PR can be merged.
