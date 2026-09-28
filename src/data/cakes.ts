import bouquet from '@/assets/cakes/bouquet.jpeg'
import butterflies from '@/assets/cakes/butterflies.jpeg'
import flowers from '@/assets/cakes/flowers.jpeg'
import goldButterflies from '@/assets/cakes/gold-butterflies.jpeg'
import pearls from '@/assets/cakes/pearls.jpeg'
import ribbons from '@/assets/cakes/ribbons.jpeg'
import { fillings } from '@/data/options'
import { singleTierSizes } from '@/data/pricing'
import type { Cake, CakeCategory } from '@/types'

const priceNote = 'السعر حسب المقاس من قائمة التورت الأساسية. تفاصيل التصميم خارج القائمة تُراجع قبل التأكيد.'
const servingInfo = 'عدد الأفراد يحدد المقاس المناسب من قائمة الأسعار.'
const sizeIds = singleTierSizes.map((size) => size.id)
const fillingIds = fillings.map((filling) => filling.id)
const extraIds = ['sugar-figures', 'edible-print']

function cake(
  input: Pick<Cake, 'id' | 'name' | 'description' | 'image' | 'imageAlt' | 'imagePosition' | 'category'>,
): Cake {
  return {
    ...input,
    pricingGroup: 'single',
    basePrice: null,
    priceNote,
    servingInfo,
    availableSizeIds: sizeIds,
    fillingIds,
    extraIds,
  }
}

export const categoryLabels: Record<CakeCategory | 'all', string> = {
  all: 'الكل',
  birthday: 'أعياد ميلاد',
  celebration: 'مناسبات',
}

export const cakes: Cake[] = [
  cake({
    id: 'butterflies',
    name: 'تورتة الفراشات',
    description: 'تورتة وردية بفراشات ولمسات ذهبية.',
    image: butterflies,
    imageAlt: 'تورتة وردية مزينة بفراشات وخرز لؤلؤ',
    imagePosition: 'center',
    category: 'birthday',
  }),
  cake({
    id: 'flowers',
    name: 'تورتة الورود',
    description: 'كريمة بيضاء مع ورود وردية وكريمية ولمعة ذهبية.',
    image: flowers,
    imageAlt: 'تورتة بيضاء مزينة بورود وردية وكريمية وورق ذهب',
    imagePosition: 'center',
    category: 'celebration',
  }),
  cake({
    id: 'ribbons',
    name: 'تورتة الفيونكات',
    description: 'حواف مزخرفة وفيونكات، مناسبة لعيد الميلاد.',
    image: ribbons,
    imageAlt: 'تورتة بنفسجية فاتحة بحواف مزخرفة وفيونكات',
    imagePosition: 'center',
    category: 'birthday',
  }),
  cake({
    id: 'gold-butterflies',
    name: 'تورتة الفراشات الذهبية',
    description: 'سطح وردي مع فراشات وورق ذهب.',
    image: goldButterflies,
    imageAlt: 'تورتة وردية بفراشات ذهبية وكتابة على السطح',
    imagePosition: 'center',
    category: 'birthday',
  }),
  cake({
    id: 'pearls',
    name: 'تورتة اللؤلؤ',
    description: 'خرز لؤلؤ وفراشات وردية مع رقم في المنتصف.',
    image: pearls,
    imageAlt: 'تورتة وردية بلؤلؤ وفراشات ورقم من الخرز',
    imagePosition: 'center',
    category: 'birthday',
  }),
  cake({
    id: 'bouquet',
    name: 'بوكيه الورد',
    description: 'تورتة على شكل بوكيه ورد، مع فيونكة.',
    image: bouquet,
    imageAlt: 'تورتة على شكل بوكيه ورد خوخي مع فيونكة ذهبية',
    imagePosition: 'center 40%',
    category: 'celebration',
  }),
]
