const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"])

export const isSqlAuth = (): boolean => {
  const flag = process.env.NEXT_PUBLIC_SQL_AUTH
  return flag != null && TRUTHY_VALUES.has(flag.toLowerCase())
}

export default isSqlAuth
