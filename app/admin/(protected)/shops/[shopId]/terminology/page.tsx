import { AdminShopTerminology } from '@/components/admin/AdminShopTerminology'

export default function AdminShopTerminologyPage({
    params
}: {
    params: { shopId: string }
}) {
    return <AdminShopTerminology shopId={params.shopId} />
}
