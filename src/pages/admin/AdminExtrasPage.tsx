import { IconSparkles } from '@/components/admin/icons'
import { PricedItemsManager } from '@/components/admin/PricedItemsManager'
import { usePageTitle } from '@/hooks/usePageTitle'
import { listAdminExtras, upsertAdminExtra } from '@/services/admin/adminCatalogService'

export function AdminExtrasPage() {
  usePageTitle('الإضافات | مستكة')
  return (
    <PricedItemsManager
      idPrefix="extra"
      title="الإضافات"
      description="إضافات التصميم وأسعارها كما تظهر للعميل أثناء الطلب."
      noun="إضافة"
      addLabel="إضافة عنصر"
      newTitle="إضافة جديدة"
      editTitle="تعديل الإضافة"
      disableTitle="تعطيل الإضافة؟"
      disableBody="لن تظهر هذه الإضافة للعملاء في الطلب بعد الحفظ. الطلبات السابقة لا تتأثر، ويمكنك إعادة تفعيلها لاحقًا."
      emptyTitle="لا توجد إضافات"
      emptyDescription="أضيفي إضافات التصميم لتظهر للعملاء أثناء الطلب."
      icon={<IconSparkles />}
      defaultStatus="quote"
      list={listAdminExtras}
      upsert={upsertAdminExtra}
    />
  )
}
