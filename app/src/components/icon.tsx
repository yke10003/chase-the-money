import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native';

import { useTheme } from '@/state/theme';

// Per-icon modules keep the other ~3,000 icons out of the bundle. `require` keeps tsc from
// type-checking phosphor's TypeScript sources, which do not match react-native-svg 15.15's types.
const ArmchairIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Armchair').ArmchairIcon;
const ArrowsClockwiseIcon: PhosphorIcon = require('phosphor-react-native/src/icons/ArrowsClockwise').ArrowsClockwiseIcon;
const BarcodeIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Barcode').BarcodeIcon;
const CameraIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Camera').CameraIcon;
const CoinsIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Coins').CoinsIcon;
const DeviceMobileIcon: PhosphorIcon = require('phosphor-react-native/src/icons/DeviceMobile').DeviceMobileIcon;
const ImageIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Image').ImageIcon;
const PlugIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Plug').PlugIcon;
const RulerIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Ruler').RulerIcon;
const SneakerIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Sneaker').SneakerIcon;
const WatchIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Watch').WatchIcon;
const RocketIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Rocket').RocketIcon;
const StorefrontIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Storefront').StorefrontIcon;
const ArrowCounterClockwiseIcon: PhosphorIcon = require('phosphor-react-native/src/icons/ArrowCounterClockwise').ArrowCounterClockwiseIcon;
const ArrowLeftIcon: PhosphorIcon = require('phosphor-react-native/src/icons/ArrowLeft').ArrowLeftIcon;
const ArrowRightIcon: PhosphorIcon = require('phosphor-react-native/src/icons/ArrowRight').ArrowRightIcon;
const ArrowUpRightIcon: PhosphorIcon = require('phosphor-react-native/src/icons/ArrowUpRight').ArrowUpRightIcon;
const BicycleIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Bicycle').BicycleIcon;
const BriefcaseIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Briefcase').BriefcaseIcon;
const CalendarBlankIcon: PhosphorIcon = require('phosphor-react-native/src/icons/CalendarBlank').CalendarBlankIcon;
const CaretDownIcon: PhosphorIcon = require('phosphor-react-native/src/icons/CaretDown').CaretDownIcon;
const CaretRightIcon: PhosphorIcon = require('phosphor-react-native/src/icons/CaretRight').CaretRightIcon;
const ChartLineUpIcon: PhosphorIcon = require('phosphor-react-native/src/icons/ChartLineUp').ChartLineUpIcon;
const ChatCircleIcon: PhosphorIcon = require('phosphor-react-native/src/icons/ChatCircle').ChatCircleIcon;
const CheckIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Check').CheckIcon;
const CheckCircleIcon: PhosphorIcon = require('phosphor-react-native/src/icons/CheckCircle').CheckCircleIcon;
const ClockIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Clock').ClockIcon;
const CompassIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Compass').CompassIcon;
const CreditCardIcon: PhosphorIcon = require('phosphor-react-native/src/icons/CreditCard').CreditCardIcon;
const DiamondIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Diamond').DiamondIcon;
const DotsThreeIcon: PhosphorIcon = require('phosphor-react-native/src/icons/DotsThree').DotsThreeIcon;
const FileTextIcon: PhosphorIcon = require('phosphor-react-native/src/icons/FileText').FileTextIcon;
const FlagIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Flag').FlagIcon;
const HandCoinsIcon: PhosphorIcon = require('phosphor-react-native/src/icons/HandCoins').HandCoinsIcon;
const HandshakeIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Handshake').HandshakeIcon;
const HourglassIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Hourglass').HourglassIcon;
const HouseIcon: PhosphorIcon = require('phosphor-react-native/src/icons/House').HouseIcon;
const LaptopIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Laptop').LaptopIcon;
const LightbulbIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Lightbulb').LightbulbIcon;
const LightningIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Lightning').LightningIcon;
const LinkIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Link').LinkIcon;
const MegaphoneIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Megaphone').MegaphoneIcon;
const LockIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Lock').LockIcon;
const MagnifyingGlassIcon: PhosphorIcon = require('phosphor-react-native/src/icons/MagnifyingGlass').MagnifyingGlassIcon;
const MedalIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Medal').MedalIcon;
const PackageIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Package').PackageIcon;
const PaperPlaneTiltIcon: PhosphorIcon = require('phosphor-react-native/src/icons/PaperPlaneTilt').PaperPlaneTiltIcon;
const PauseIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Pause').PauseIcon;
const PencilSimpleIcon: PhosphorIcon = require('phosphor-react-native/src/icons/PencilSimple').PencilSimpleIcon;
const PlayIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Play').PlayIcon;
const PlusIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Plus').PlusIcon;
const ReceiptIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Receipt').ReceiptIcon;
const ScissorsIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Scissors').ScissorsIcon;
const SignOutIcon: PhosphorIcon = require('phosphor-react-native/src/icons/SignOut').SignOutIcon;
const TagIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Tag').TagIcon;
const TargetIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Target').TargetIcon;
const TrashIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Trash').TrashIcon;
const TrendUpIcon: PhosphorIcon = require('phosphor-react-native/src/icons/TrendUp').TrendUpIcon;
const TrophyIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Trophy').TrophyIcon;
const TShirtIcon: PhosphorIcon = require('phosphor-react-native/src/icons/TShirt').TShirtIcon;
const UserCircleIcon: PhosphorIcon = require('phosphor-react-native/src/icons/UserCircle').UserCircleIcon;
const UserPlusIcon: PhosphorIcon = require('phosphor-react-native/src/icons/UserPlus').UserPlusIcon;
const UsersThreeIcon: PhosphorIcon = require('phosphor-react-native/src/icons/UsersThree').UsersThreeIcon;
const WalletIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Wallet').WalletIcon;
const WarningIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Warning').WarningIcon;
const WrenchIcon: PhosphorIcon = require('phosphor-react-native/src/icons/Wrench').WrenchIcon;
const XIcon: PhosphorIcon = require('phosphor-react-native/src/icons/X').XIcon;

const ICONS = {
  armchair: ArmchairIcon,
  arrowsClockwise: ArrowsClockwiseIcon,
  barcode: BarcodeIcon,
  camera: CameraIcon,
  coins: CoinsIcon,
  deviceMobile: DeviceMobileIcon,
  image: ImageIcon,
  plug: PlugIcon,
  ruler: RulerIcon,
  sneaker: SneakerIcon,
  watch: WatchIcon,
  arrowLeft: ArrowLeftIcon,
  arrowRight: ArrowRightIcon,
  arrowUpRight: ArrowUpRightIcon,
  bicycle: BicycleIcon,
  briefcase: BriefcaseIcon,
  calendar: CalendarBlankIcon,
  caretDown: CaretDownIcon,
  caretRight: CaretRightIcon,
  chart: ChartLineUpIcon,
  chat: ChatCircleIcon,
  check: CheckIcon,
  checkCircle: CheckCircleIcon,
  clock: ClockIcon,
  compass: CompassIcon,
  creditCard: CreditCardIcon,
  diamond: DiamondIcon,
  dots: DotsThreeIcon,
  fileText: FileTextIcon,
  flag: FlagIcon,
  handCoins: HandCoinsIcon,
  handshake: HandshakeIcon,
  hourglass: HourglassIcon,
  house: HouseIcon,
  laptop: LaptopIcon,
  lightbulb: LightbulbIcon,
  lightning: LightningIcon,
  link: LinkIcon,
  lock: LockIcon,
  megaphone: MegaphoneIcon,
  search: MagnifyingGlassIcon,
  medal: MedalIcon,
  package: PackageIcon,
  send: PaperPlaneTiltIcon,
  pause: PauseIcon,
  pencil: PencilSimpleIcon,
  play: PlayIcon,
  plus: PlusIcon,
  receipt: ReceiptIcon,
  refund: ArrowCounterClockwiseIcon,
  rocket: RocketIcon,
  storefront: StorefrontIcon,
  scissors: ScissorsIcon,
  signOut: SignOutIcon,
  tag: TagIcon,
  target: TargetIcon,
  trash: TrashIcon,
  trendUp: TrendUpIcon,
  trophy: TrophyIcon,
  tshirt: TShirtIcon,
  user: UserCircleIcon,
  userPlus: UserPlusIcon,
  users: UsersThreeIcon,
  wallet: WalletIcon,
  warning: WarningIcon,
  wrench: WrenchIcon,
  x: XIcon,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color,
  weight = 'regular',
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: IconWeight;
}) {
  const theme = useTheme();
  const Glyph = ICONS[name];

  return <Glyph size={size} color={color ?? theme.color.ink} weight={weight} />;
}
