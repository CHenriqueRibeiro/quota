import type { AuthenticatedUser, UserRole } from "../types/auth";

class PermissionService {

  hasRole(
    user: AuthenticatedUser,
    ...roles: UserRole[]
  ) {
    return roles.includes(user.role);
  }

  canManageUsers(user: AuthenticatedUser) {
    return this.hasRole(user, "ADMIN", "MANAGER");
  }

  canManageScopes(user: AuthenticatedUser) {
    return this.hasRole(user, "ADMIN", "MANAGER");
  }

  canManageApiKeys(user: AuthenticatedUser) {
    return this.hasRole(user, "ADMIN", "MANAGER");
  }

  canManageProviders(user: AuthenticatedUser) {
    return this.hasRole(user, "ADMIN", "MANAGER");
  }

  canManageAlerts(user: AuthenticatedUser) {
    return this.hasRole(user, "ADMIN", "MANAGER");
  }

  canViewDashboard(user: AuthenticatedUser) {
    return true;
  }

  isAdmin(user: AuthenticatedUser) {
    return user.role === "ADMIN";
  }

  isOwner(user: AuthenticatedUser) {
    return user.role === "ADMIN";
  }

}

export default new PermissionService();