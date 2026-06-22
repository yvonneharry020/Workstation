import { View, type ViewProps } from 'react-native'

interface CardProps extends ViewProps {
  children: React.ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function Card({ children, padding = 'md', className, ...props }: CardProps) {
  return (
    <View
      className={`bg-surface-card border border-surface-border rounded-2xl ${paddingStyles[padding]} ${className ?? ''}`}
      {...props}
    >
      {children}
    </View>
  )
}
