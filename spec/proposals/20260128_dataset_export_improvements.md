# Proposal: Dataset Export Improvements

**Date**: 2026-01-28
**Author**: Claude Agent
**Status**: Implemented

## Background

The current dataset export functionality has several issues that need to be addressed:

1. **No Approval Workflow on Dataset Page**: Users want to review annotation counts and click "Create New Version" to approve annotations for export. Currently, annotations are individually validated (PENDING/APPROVED/REJECTED) in the annotation workspace, but there's no consolidated approval step on the datasets page.

2. **Hugging Face Repo ID User Input**: The destination HF repo is already defined for the project, but users must manually enter the repo ID. This should be preset via environment variable.

3. **No Access Control**: Currently all authenticated users can access the Dataset Management page and trigger exports/evaluations. Only administrators should have access.

## Proposal

### 1. Approval Workflow Enhancement

Add a "pending export" count and approval workflow on the Dataset Management page:

**UI Changes**:
- Display count of APPROVED annotations that haven't been exported yet (not in any DatasetVersion)
- Add "Approve for Export" button that shows summary before creating new version
- Rename current "Create New Version" to clarify it exports APPROVED annotations

**No Schema Changes Required**: The existing `validationStatus` field on Annotation model already supports this. The export Lambda already filters for APPROVED annotations.

### 2. Preset Hugging Face Repo ID

**Changes**:
- Add `HUGGING_FACE_REPO_ID` environment variable to the export-dataset Lambda
- Update UI to auto-fill repo ID from a new GraphQL query that returns the preset value
- Make repo ID field read-only when preset is configured
- Allow override only if no preset is configured

**Backend Changes**:
- Add new query `getExportConfig` that returns preset HF repo ID
- Update export-dataset Lambda to use env var as default

### 3. Admin-Only Access Control

**Approach**: Use Cognito groups for role-based access control.

**Changes**:
- Create `Admins` Cognito group
- Add `isAdmin()` utility hook to check group membership
- Protect Dataset Management page with admin check
- Show error or redirect for non-admin users
- Update navigation to hide dataset link for non-admins

**Implementation**:
```typescript
// useIsAdmin hook
const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const session = await fetchAuthSession();
      const groups = session.tokens?.accessToken?.payload['cognito:groups'] || [];
      setIsAdmin(groups.includes('Admins'));
    };
    checkAdmin();
  }, []);

  return isAdmin;
};
```

## Impact

### Requirements
- Add REQ-DS-010: "Dataset export configuration shall be preset via environment"
- Add REQ-SEC-010: "Dataset Management page shall be restricted to administrators"

### Design
- Update Section 5 (Authorization) to include Cognito groups for RBAC
- Add export configuration details

### Tasks
- Add tasks to Sprint 4 Phase 3 for these enhancements

## Alternatives Considered

1. **Custom attribute for admin role**: Using `custom:role` Cognito attribute instead of groups. Rejected because groups are the standard Cognito pattern for RBAC.

2. **Hardcoded repo ID in frontend**: Rejected because it exposes configuration in client code and isn't flexible across environments.

3. **Database-stored configuration**: Storing export config in DynamoDB. Rejected for simplicity - environment variables are sufficient for a single preset value.

## Implementation Plan

1. **Phase 1 - Admin Access Control** (Priority: High)
   - Create Cognito `Admins` group via AWS Console
   - Add `useIsAdmin` hook
   - Protect Dataset Management page
   - Update navigation

2. **Phase 2 - Preset HF Repo ID** (Priority: Medium)
   - Add `HF_REPO_ID` environment variable
   - Create `getExportConfig` query
   - Update UI to use preset value

3. **Phase 3 - Approval Workflow** (Priority: Low - current flow works)
   - Add pending annotation count display
   - Improve "Create New Version" UX with summary dialog

## Testing

- Verify non-admin users cannot access Dataset Management
- Verify preset repo ID is used when configured
- Verify export still works with preset repo ID
