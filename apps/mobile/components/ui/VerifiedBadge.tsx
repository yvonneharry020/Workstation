import { View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

interface Props {
  size?: number
}

export function VerifiedBadge({ size = 16 }: Props) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="12" fill="#1D9BF0" />
        <Path
          d="M6 12.5L9.8 16.5L18.5 7.5"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  )
}
