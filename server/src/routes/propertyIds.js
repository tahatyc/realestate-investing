export function isPropertyIdValidationError(error) {
  return error?.code === 'ConvexValidationError' && /v\.id\(["']properties["']\)/.test(error.message ?? '');
}

export async function findPropertyForRoute(id, database, getPropertyById) {
  try {
    return await getPropertyById(id, database);
  } catch (error) {
    if (isPropertyIdValidationError(error)) {
      return null;
    }
    throw error;
  }
}
