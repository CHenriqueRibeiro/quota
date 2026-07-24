import type { AuthenticatedUser, UserRole } from "../types/auth";

class PermissionService {

  hasRole(
    user: AuthenticatedUser,
    ...roles: UserRole[]
  ) {
    return roles.includes(user.role);
  }

  canManageUsers(user: AuthenticatedUser) {
    return this.hasRole(user, "OWNER", "MANAGER");
  }

  canManageScopes(user: AuthenticatedUser) {
    return this.hasRole(user, "OWNER", "MANAGER");
  }

  canManageApiKeys(user: AuthenticatedUser) {
    return this.hasRole(user, "OWNER", "MANAGER");
  }

  canManageProviders(user: AuthenticatedUser) {
    return this.hasRole(user, "OWNER", "MANAGER");
  }

  canManageAlerts(user: AuthenticatedUser) {
    return this.hasRole(user, "OWNER", "MANAGER");
  }

  canViewDashboard(user: AuthenticatedUser) {
    return true;
  }

  isOwner(user: AuthenticatedUser) {
    return user.role === "OWNER";
  }

}

export default new PermissionService();