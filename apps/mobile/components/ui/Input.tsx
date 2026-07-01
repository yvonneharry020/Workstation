import { View, Text, TextInput, type TextInputProps } from 'react-native'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, ...props }: InputProps) {
  const hasBorderError = Boolean(error)

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-slate-300 text-sm font-medium mb-2">{label}</Text>
      )}
      <TextInput
        placeholderTextColor="#475569"
        {...props}
        className={`
          bg-surface-card border rounded-xl px-4 py-4 text-[#1A1625] text-base
          ${hasBorderError ? 'border-red-500' : 'border-surface-border'}
          ${props.className ?? ''}
        `}
      />
      {error && (
        <Text className="text-red-400 text-xs mt-1">{error}</Text>
      )}
      {hint && !error && (
        <Text className="text-slate-500 text-xs mt-1">{hint}</Text>
      )}
    </View>
  )
}
