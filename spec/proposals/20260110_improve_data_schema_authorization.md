# Proposal: Improve Data Schema Authorization and Relationships

**Date**: 2026-01-10
**Author**: Claude Agent
**Status**: Proposed

## Background

The current data schema in `amplify/data/resource.ts` has several critical issues that need to be addressed before building the frontend UI:

### Current Problems

1. **Weak Authorization**: Using `allow.authenticated()` for both Image and Annotation models allows any authenticated user to read, create, update, and delete all data, including data they don't own.

2. **Missing Relationships**: No explicit relationships between Image and Annotation models, making it difficult to query related data efficiently.

3. **No Role-Based Access Control**: No distinction between regular users, curators, and administrators.

4. **Security Risk**: Users can delete other users' images and modify other users' annotations.

5. **Missing Owner Tracking**: While `uploadedBy` and `createdBy` fields exist, they're not used for authorization.

## Proposal

### 1. Implement Fine-Grained Authorization

Replace the simple `allow.authenticated()` with a multi-level authorization strategy:

#### Image Model Authorization
```typescript
.authorization((allow) => [
  // Anyone authenticated can read (for gallery view)
  allow.authenticated().to(['read']),

  // Owner can create and delete their own images
  allow.owner('uploadedBy').to(['create', 'delete']),

  // Curators and Admins can update and delete any image
  allow.groups(['curators', 'admins']).to(['update', 'delete'])
])
```

#### Annotation Model Authorization
```typescript
.authorization((allow) => [
  // Anyone authenticated can read
  allow.authenticated().to(['read']),

  // Owner can create, update, delete their own annotations
  allow.owner('createdBy').to(['create', 'update', 'delete']),

  // Curators and Admins have full access
  allow.groups(['curators', 'admins'])
])
```

### 2. Add Explicit Relationships

Define `hasMany` and `belongsTo` relationships:

```typescript
Image: a.model({
  // ... existing fields
  annotations: a.hasMany('Annotation', 'imageId')
})

Annotation: a.model({
  imageId: a.id().required(),
  image: a.belongsTo('Image', 'imageId'),
  // ... existing fields
})
```

**Benefits**:
- Automatic eager loading: `getImage` can include annotations
- Type-safe queries
- Better GraphQL schema generation
- Clearer data model for developers

### 3. Add Dataset Model

Introduce a Dataset model to organize images and annotations into versioned datasets:

```typescript
Dataset: a.model({
  name: a.string().required(),
  description: a.string(),
  status: a.enum(['ACTIVE', 'ARCHIVED']).required(),

  // Relationships
  images: a.hasMany('Image', 'datasetId'),

  // Metadata
  createdBy: a.string().required(),
  createdAt: a.datetime().required(),
  updatedAt: a.datetime()
})
.authorization((allow) => [
  allow.authenticated().to(['read']),
  allow.owner('createdBy').to(['create', 'update', 'delete']),
  allow.groups(['curators', 'admins'])
])
```

Update Image model:
```typescript
Image: a.model({
  // Add dataset relationship
  datasetId: a.id(),
  dataset: a.belongsTo('Dataset', 'datasetId'),
  // ... existing fields
})
```

### 4. Improve Field Definitions

#### Add Missing Constraints
- `s3Key`: Should be unique within dataset
- `fileName`: Add max length validation
- `language`: Validate against ISO 639-1 codes
- `width`, `height`: Add positive number validation

#### Computed Fields (Future)
Consider adding GraphQL custom queries for:
- `presignedUrl`: Generate S3 presigned URLs on-demand
- `annotationCount`: Count annotations per image
- `validationRate`: Calculate approval/rejection ratio

### 5. Add Indexes for Performance

Add secondary indexes for common query patterns:

```typescript
Image: a.model({
  // ... fields
})
.secondaryIndexes((index) => [
  index('uploadedBy').queryField('imagesByUploader'),
  index('status').queryField('imagesByStatus'),
  index('documentType').queryField('imagesByDocumentType')
])
```

## Impact

### Requirements (requirements.md)
- No changes to requirements needed
- All existing requirements remain valid
- Authorization improvements enhance security requirements

### Design (design.md)
- Update Section 2.1 (Database Schema) with new authorization rules
- Add Dataset model to schema
- Document relationship definitions
- Update GraphQL schema examples with new queries

### Tasks (tasks.md)
New implementation tasks:
1. Update `amplify/data/resource.ts` with improved authorization
2. Add relationships between Image and Annotation
3. Implement Dataset model
4. Add secondary indexes
5. Update GraphQL code generation (`npx ampx generate graphql-client-code`)
6. Test authorization rules with different user roles
7. Update frontend code to use new GraphQL queries with relationships

## Alternatives Considered

### Alternative 1: Keep Simple Authorization, Add Application-Level Checks
**Rejected**: Application-level authorization is error-prone and can be bypassed. Schema-level authorization is enforced by AppSync and cannot be circumvented.

### Alternative 2: Use Custom Resolvers for All Authorization
**Rejected**: Adds complexity and maintenance burden. Amplify Gen2's declarative authorization is simpler and follows AWS best practices.

### Alternative 3: No Dataset Model (Flat Structure)
**Considered**: Could work for MVP, but Dataset model provides better organization for version management and Hugging Face publishing. Better to add it now than migrate later.

## Implementation Plan

### Phase 1: Authorization Improvements (Priority: High)
1. Create Cognito user groups: `curators`, `admins`
2. Update `amplify/data/resource.ts` with new authorization rules
3. Run `npx ampx generate graphql-client-code` to regenerate types
4. Test authorization with different user roles

### Phase 2: Relationship Definitions (Priority: High)
1. Add `hasMany` and `belongsTo` relationships
2. Regenerate GraphQL schema
3. Update queries to use relationship loading
4. Test nested queries (e.g., `getImage` with annotations)

### Phase 3: Dataset Model (Priority: Medium)
1. Add Dataset model to schema
2. Update Image model with `datasetId` field
3. Migrate existing images to default dataset
4. Update UI to support dataset selection

### Phase 4: Performance Indexes (Priority: Low)
1. Add secondary indexes for common queries
2. Test query performance
3. Monitor DynamoDB metrics

### Phase 5: Field Validation (Priority: Medium)
1. Add validation rules (max length, format, etc.)
2. Add custom validation logic where needed
3. Update frontend forms with validation

## Migration Strategy

### For Existing Data
1. **Backup**: Export all existing images and annotations before schema changes
2. **Default Dataset**: Create a default dataset for existing images
3. **Data Migration**: Script to add `datasetId` to existing images
4. **Verify**: Test data integrity after migration

### Rollback Plan
If issues occur:
1. Revert `resource.ts` to previous version
2. Run `npx ampx push` to restore old schema
3. Restore data from backup if needed

## Testing Plan

### Authorization Tests
```typescript
// Test 1: User can only delete their own images
// Test 2: Curator can update any image
// Test 3: Non-owner cannot delete other's images
// Test 4: Unauthenticated user cannot access any data
```

### Relationship Tests
```typescript
// Test 1: getImage returns annotations automatically
// Test 2: Annotation.image returns parent image
// Test 3: Deleting image cascades to annotations (or prevents deletion)
```

### Performance Tests
```typescript
// Test 1: Query images by status using index
// Test 2: Query images by uploader using index
// Test 3: Measure query latency before/after indexes
```

## Risk Assessment

### Low Risk
- Authorization improvements: AppSync handles this natively
- Relationship definitions: Well-documented Amplify feature

### Medium Risk
- Dataset model: Requires data migration for existing images
- Secondary indexes: May increase DynamoDB costs slightly

### Mitigation
- Test thoroughly in sandbox environment first
- Implement migration scripts with rollback capability
- Monitor AWS costs after index implementation

## Success Criteria

1. ✅ Users can only delete their own images (except curators/admins)
2. ✅ Curators can manage all images and annotations
3. ✅ `getImage` query automatically includes annotations
4. ✅ Dataset model supports versioned dataset creation
5. ✅ All existing data migrated successfully
6. ✅ No performance degradation in common queries
7. ✅ GraphQL types regenerated correctly

## References

- [AWS Amplify Gen2 Authorization](https://docs.amplify.aws/gen2/build-a-backend/data/customize-authz/)
- [Amplify Data Relationships](https://docs.amplify.aws/gen2/build-a-backend/data/data-modeling/relationships/)
- [AppSync Security Best Practices](https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html)

---

**Next Steps**:
1. Review and approve this proposal
2. Implement Phase 1 (Authorization) immediately
3. Implement Phase 2 (Relationships) before frontend development
4. Schedule Phase 3 (Dataset model) for Sprint 2
