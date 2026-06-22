import { Pressable, Text, ActivityIndicator } from 'react-native'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
}

const variantStyles: Record<Variant, { container: string; text: string }> = {
  primary: { container: 'bg-primary-500', text: 'text-white' },
  secondary: { container: 'bg-surface-card border border-surface-border', text: 'text-white' },
  ghost: { container: 'bg-transparent', text: 'text-primary-400' },
  destructive: { container: 'bg-red-600', text: 'text-white' },
}

const sizeStyles: Record<Size, { container: string; text: string }> = {
  sm: { container: 'rounded-lg px-3 py-2', text: 'text-sm' },
  md: { container: 'rounded-xl px-4 py-3', text: 'text-base' },
  lg: { container: 'rounded-2xl px-6 py-4', text: 'text-base' },
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading
  const v = variantStyles[variant]
  const s = sizeStyles[size]

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`
        ${v.container} ${s.container}
        flex-row items-center justify-center gap-2
        ${fullWidth ? 'w-full' : 'self-start'}
        ${isDisabled ? 'opacity-50' : ''}
      `}
    >
      {loading && <ActivityIndicator size="small" color="#fff" />}
      <Text className={`${v.text} ${s.text} font-semibold`}>{label}</Text>
    </Pressable>
  )
}
