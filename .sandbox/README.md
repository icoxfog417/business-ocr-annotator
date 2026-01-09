# Sandbox Directory

This directory contains investigation samples for testing AWS Amplify Gen2 components and integrations in isolated environments.

## Purpose

Before implementing production features, verify AWS Amplify Gen2 components and integrations in isolated sandbox environments. This reduces risk and documents working patterns.

## Guidelines

**DO**:
- ✅ Create minimal, focused samples
- ✅ Test one feature at a time
- ✅ Document findings thoroughly
- ✅ Include README explaining the test
- ✅ Use realistic test data
- ✅ Verify against AWS Amplify Gen2 best practices

**DON'T**:
- ❌ Mix multiple features in one sample
- ❌ Include production code
- ❌ Add unnecessary dependencies
- ❌ Commit secrets or credentials
- ❌ Skip documentation
- ❌ Leave samples in broken state

## Directory Structure

```
.sandbox/
├── README.md                     # This file
├── .gitkeep                      # Preserve directory in git
├── {feature-name}/              # Individual verification tests
│   ├── README.md                # What this test verifies
│   ├── amplify/                 # Amplify configuration
│   ├── src/                     # Source code
│   └── package.json             # Dependencies
└── ...
```

**Note**: The `.sandbox/` directory is in `.gitignore` except for `.gitkeep` and `README.md`. Sandbox samples are disposable learning environments.
