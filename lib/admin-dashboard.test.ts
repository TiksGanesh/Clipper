import { getShopAdminDashboardCounts } from '@/lib/admin-dashboard'

// Simple smoke test for getShopAdminDashboardCounts
// (Assumes test runner can run async functions)

describe('getShopAdminDashboardCounts', () => {
  it('returns a typed object with all keys', async () => {
    const result = await getShopAdminDashboardCounts()
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('active')
    expect(result).toHaveProperty('trial')
    expect(result).toHaveProperty('suspended')
    expect(result).toHaveProperty('expired')
    expect(result).toHaveProperty('setup_pending')
    expect(typeof result.total).toBe('number')
  })
})
