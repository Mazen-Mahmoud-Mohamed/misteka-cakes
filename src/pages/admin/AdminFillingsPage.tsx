import { IconLayers } from '@/components/admin/icons'
import { PricedItemsManager } from '@/components/admin/PricedItemsManager'
import { usePageTitle } from '@/hooks/usePageTitle'
import { listAdminFillings, upsertAdminFilling } from '@/services/admin/adminCatalogService'

export function AdminFillingsPage() {
  usePageTitle('الحشوات | مستكة')
  return (
    <PricedItemsManager
      idPrefix="fill"
      title="الحشوات"
      description="الحشوات وأسعارها كما تظهر للعميل أثناء الطلب."
      noun="حشوة"
      addLabel="إضافة حشوة"
      newTitle="حشوة جديدة"
      editTitle="تعديل الحشوة"
      disableTitle="تعطيل الحشوة؟"
      disableBody="لن تظهر هذه الحشوة للعملاء في الطلب بعد الحفظ. الطلبات السابقة لا تتأثر، ويمكنك إعادة تفعيلها لاحقًا."
      emptyTitle="لا توجد حشوات"
      emptyDescription="أضيفي الحشوات المتاحة لتظهر للعملاء أثناء الطلب."
      icon={<IconLayers />}
      defaultStatus="pending"
      list={listAdminFillings}
      upsert={upsertAdminFilling}
    />
  )
}
