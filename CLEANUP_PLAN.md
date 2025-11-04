# Codebase Cleanup Plan

## Files to Remove After Migration

### 1. Old Database Configuration
- [ ] `src/authentication/src/Config/neon-database.js` - Replace with TypeORM connection
- [ ] `src/authentication/src/Config/setupDatabase.js` - Replace with TypeORM migrations

### 2. Redundant Test Files (Move to proper test directory)
Current location: `/test/`
Should be: `/tests/` or `/src/__tests__/`

Files to organize:
- [ ] `test/admin_auth_middleware.test.js`
- [ ] `test/admin_controller.test.js`
- [ ] `test/admin_token_util.test.js`
- [ ] `test/azure_blob_service.test.js`
- [ ] `test/blacklist-auth.test.js`

### 3. Duplicate Code to Consolidate

#### User Model Duplications
File: `src/authentication/src/models/user.model.js`
Issues:
- `invalidateSession()` method defined twice (lines ~600 and ~620)
- `initiatePasswordReset()` method defined twice (lines ~500 and ~750)
- `getWalletBalances()` method defined twice

Action: Remove duplicate methods, keep the most complete version.

#### OTP Model Duplications
File: `src/authentication/src/models/otp.model.js`
Issues:
- `generate()` method defined twice
- `#send()` and `sendOTP()` do the same thing

Action: Keep only the private `#send()` method and `generate()` method.

### 4. Unused/Redundant Folders

#### Check if these are used:
- [ ] `.devcontainer/` - Only needed if using VS Code devcontainers
- [ ] `.github/workflows/` - Check if CI/CD is active
- [ ] `scripts/` - Contains `create-super-admin.js` (keep if used)
- [ ] `test-assets/` - Move to proper test directory

### 5. Configuration Files to Review
- [ ] `compass.yml` - MongoDB Compass config (not using MongoDB)
- [ ] `docker-compose.yaml` - Review if still needed
- [ ] `Dockerfile` - Update for new setup
- [ ] `deploy-api-worker.sh` - Update deployment script
- [ ] `globalenv.config` - Consolidate with .env
- [ ] `smile_config.json` - Move to config directory
- [ ] `swagger.json` - Regenerate from code

### 6. Code Smells to Fix

#### Authentication Controller
File: `src/authentication/src/controllers/auth.controller.js`
Issues:
- Mixed concerns (KYC upload in auth controller)
- Large file (800+ lines)
- Some methods should be in separate controllers

Refactor:
```
auth.controller.js (login, register, logout, password reset)
kyc.controller.js (document upload, verification)
profile.controller.js (user profile, account management)
```

#### Models vs Repositories
Current: Using model classes with static methods
Target: Use TypeORM repositories with service layer

Migration path:
1. Create repository classes in `src/database/repositories/`
2. Update services to use repositories
3. Deprecate old model files
4. Remove model files after full migration

### 7. Environment Variables Cleanup

#### Consolidate .env files
Current: Multiple env references
- `.env`
- `globalenv.config`

Action: Use only `.env` and `.env.example`

#### Remove unused variables
Check if these are used:
- `NEON_POSTGRES_URL` - Remove after migration
- `CORS_ORIGIN` - Verify usage
- `ADMIN_DASHBOARD_URL` - Verify usage

### 8. Documentation Updates

#### Files to update:
- [x] `src/authentication/README.MD` - Updated
- [ ] `src/Investment/Readme.md` - Needs update
- [ ] Root `README.md` - Create if missing
- [ ] API documentation in `swagger.json`

#### Files to create:
- [x] `MIGRATION_GUIDE.md` - Created
- [ ] `CONTRIBUTING.md` - Development guidelines
- [ ] `ARCHITECTURE.md` - System architecture
- [ ] `API.md` - API documentation

### 9. Dependency Cleanup

#### Remove unused dependencies:
Check package.json for:
- [ ] `@neondatabase/serverless` - Remove after migration
- [ ] `bcryptjs` - Already have `bcrypt`
- [ ] `crypto` - Built-in Node.js module
- [ ] `http` - Built-in Node.js module
- [ ] `util` - Built-in Node.js module
- [ ] `format` - Check if used
- [ ] `sav` - Unknown package, verify usage

### 10. Code Organization

#### Current structure issues:
```
src/
├── authentication/
│   └── src/          # Unnecessary nesting
│       ├── Config/   # Inconsistent casing
│       ├── controllers/
│       ├── models/
│       └── ...
└── Investment/
    └── src/          # Unnecessary nesting
```

#### Proposed structure:
```
src/
├── database/
│   ├── entities/
│   ├── migrations/
│   ├── repositories/
│   └── config/
├── modules/
│   ├── auth/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── routes/
│   ├── kyc/
│   ├── investment/
│   ├── admin/
│   └── wallet/
├── shared/
│   ├── utils/
│   ├── middleware/
│   └── config/
├── app.js
└── server.js
```

## Cleanup Execution Order

### Phase 1: Immediate (No Breaking Changes)
1. Remove duplicate methods in models
2. Fix code formatting inconsistencies
3. Update documentation
4. Remove unused dependencies
5. Organize test files

### Phase 2: Migration (Requires Testing)
1. Implement TypeORM repositories
2. Update services to use repositories
3. Test all endpoints
4. Remove old database files

### Phase 3: Restructure (Major Refactor)
1. Reorganize folder structure
2. Split large controllers
3. Implement proper separation of concerns
4. Update all imports

### Phase 4: Final Cleanup
1. Remove deprecated files
2. Update deployment scripts
3. Final documentation review
4. Performance optimization

## Testing Checklist

After each cleanup phase:
- [ ] All tests pass
- [ ] Authentication flow works
- [ ] KYC upload works
- [ ] Wallet operations work
- [ ] Admin panel accessible
- [ ] API endpoints respond correctly
- [ ] No console errors
- [ ] Database queries optimized

## Rollback Plan

For each phase:
1. Create git branch before changes
2. Commit after each logical change
3. Tag stable versions
4. Keep old files until fully tested
5. Document breaking changes

## Metrics to Track

Before and after cleanup:
- Lines of code
- Number of files
- Cyclomatic complexity
- Test coverage
- API response times
- Bundle size
- Dependencies count

## Notes

- Follow SOLID principles during refactor
- Maintain backward compatibility where possible
- Update tests alongside code changes
- Document all breaking changes
- Use feature flags for gradual rollout
