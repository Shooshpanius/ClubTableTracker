/**
 * Grimdark design-system primitives.
 * Styles live in src/styles/grimdark.css (imported once in main.tsx).
 * Tokens are namespaced (--gd-*) so the legacy theme keeps working.
 */
export { Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { Badge } from './Badge'
export type { BadgeProps, BadgeTone } from './Badge'

export { Avatar } from './Avatar'
export type { AvatarProps, AvatarSize } from './Avatar'

export { StatusDot } from './StatusDot'
export type { StatusDotProps, StatusTone } from './StatusDot'

export { GothicDivider } from './GothicDivider'
export type { GothicDividerProps } from './GothicDivider'

export { Tabs } from './Tabs'
export type { TabsProps, TabItem } from './Tabs'

export { TextInput, Select } from './Input'
export type { TextInputProps, SelectProps } from './Input'

export { Dataslate } from './Dataslate'
export type { DataslateProps } from './Dataslate'
