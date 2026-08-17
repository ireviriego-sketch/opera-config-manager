function roleSnapshot(user) {
  return (user?.roles || []).map((role) => ({
    roleId: role.roleId || role.ROLE_ID,
    roleCode: role.roleCode || role.ROLE_CODE,
    roleName: role.roleName || role.ROLE_NAME
  }));
}


function permissionSnapshot(user, scopeType) {
  return (user?.permissions || [])
    .filter((permission) => (permission.scopeType || permission.SCOPE_TYPE) === scopeType)
    .map((permission) => ({
      userPermissionId: permission.userPermissionId || permission.USER_PERMISSION_ID,
      roleId: permission.roleId || permission.ROLE_ID,
      roleCode: permission.roleCode || permission.ROLE_CODE,
      scopeType: permission.scopeType || permission.SCOPE_TYPE,
      chainId: permission.chainId || permission.CHAIN_ID,
      chainName: permission.chainName || permission.CHAIN_NAME,
      hotelId: permission.hotelId || permission.HOTEL_ID,
      hotelName: permission.hotelName || permission.HOTEL_NAME,
      isReadOnly: permission.isReadOnly || permission.IS_READ_ONLY
    }));
}


function userSnapshot(user) {
  if (!user) return null;
  return {
    userId: user.userId || user.USER_ID,
    username: user.username || user.USERNAME,
    fullName: user.fullName || user.FULL_NAME,
    email: user.email || user.EMAIL,
    status: user.status || user.STATUS,
    roles: roleSnapshot(user),
    chainPermissions: permissionSnapshot(user, 'CHAIN'),
    hotelPermissions: permissionSnapshot(user, 'HOTEL')
  };
}

module.exports = {
  roleSnapshot,
  permissionSnapshot,
  userSnapshot
};
