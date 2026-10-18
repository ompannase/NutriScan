import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useTheme } from "@/theme";

export function ScreenTitle({ children, eyebrow }: PropsWithChildren<{ eyebrow?: string }>) {
  const { colors } = useTheme();
  return <View style={styles.titleWrap}>
    {eyebrow ? <Text style={[styles.eyebrow, { color: colors.muted }]}>{eyebrow.toUpperCase()}</Text> : null}
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{children}</Text>
  </View>;
}

export function Body({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  const { colors } = useTheme();
  return <Text style={[styles.body, { color: muted ? colors.muted : colors.text }]}>{children}</Text>;
}

export function Button({
  label, onPress, variant = "primary", disabled = false,
}: { label: string; onPress: () => void; variant?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
  const { colors } = useTheme();
  const backgroundColor = variant === "primary" ? colors.primary : variant === "danger" ? colors.danger : colors.elevated;
  const color = variant === "primary" || variant === "danger" ? colors.inverse : colors.text;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor, opacity: disabled ? 0.45 : pressed ? 0.72 : 1 }]}
  ><Text style={[styles.buttonLabel, { color }]}>{label}</Text></Pressable>;
}

export function Card({ children, onPress }: PropsWithChildren<{ onPress?: () => void }>) {
  const { colors } = useTheme();
  const content = <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>;
  return onPress
    ? <Pressable accessibilityRole="button" onPress={onPress}>{content}</Pressable>
    : content;
}

export function Input(props: TextInputProps & { label: string; error?: string }) {
  const { colors } = useTheme();
  const { label, error, ...inputProps } = props;
  return <View style={styles.field}>
    <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={colors.muted}
      {...inputProps}
      style={[styles.input, { color: colors.text, borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface }, props.style]}
    />
    {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
  </View>;
}

export function Chip({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={label}
    onPress={onPress}
    disabled={!onPress}
    style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface }]}
  ><Text style={[styles.chipText, { color: selected ? colors.inverse : colors.text }]}>{label}</Text></Pressable>;
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const { colors } = useTheme();
  const percent = Math.max(0, Math.min(100, value));
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: percent }}>
    <View style={styles.progressLabel}><Body>{label}</Body><Body muted>{Math.round(percent)}%</Body></View>
    <View style={[styles.track, { backgroundColor: colors.elevated }]}>
      <View style={[styles.fill, { backgroundColor: colors.primary, width: `${percent}%` }]} />
    </View>
  </View>;
}

export function ProgressRing({ value, label }: { value?: number; label: string }) {
  const { colors } = useTheme();
  return <View accessibilityRole="progressbar" accessibilityLabel={label} style={[styles.ring, { borderColor: colors.elevated }]}>
    <Text style={[styles.ringValue, { color: colors.text }]}>{value ?? "—"}</Text>
    <Text style={[styles.ringLabel, { color: colors.muted }]}>{label}</Text>
  </View>;
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.state, { borderColor: colors.border }]}>
    <Text accessibilityRole="header" style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
    <Body muted>{message}</Body>{action}
  </View>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <EmptyState title="Couldn't load this" message={message} action={retry ? <Button label="Try again" onPress={retry} variant="secondary" /> : undefined} />;
}

export function Skeleton({ height = 64 }: { height?: number }) {
  const { colors } = useTheme();
  return <View accessibilityLabel="Loading" style={[styles.skeleton, { height, backgroundColor: colors.elevated }]} />;
}

export function Sheet({ visible, title, onClose, children }: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>) {
  const { colors } = useTheme();
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={onClose} style={styles.scrim} />
    <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
      <Text accessibilityRole="header" style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  </Modal>;
}

export function Loading() {
  const { colors } = useTheme();
  return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Body muted>Loading…</Body></View>;
}

export function Toast({ message, tone = "default" }: { message: string; tone?: "default" | "warning" }) {
  const { colors } = useTheme();
  return <View accessibilityRole="alert" style={[styles.toast, { backgroundColor: tone === "warning" ? colors.warning : colors.primary }]}>
    <Text style={[styles.buttonLabel, { color: colors.inverse }]}>{message}</Text>
  </View>;
}

const styles = StyleSheet.create({
  titleWrap: { gap: 4 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1.3 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -1 },
  body: { fontSize: 15, lineHeight: 22 },
  button: { minHeight: 48, borderRadius: 16, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  buttonLabel: { fontSize: 16, fontWeight: "700" },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, gap: 12 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "700" },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
  error: { fontSize: 12 },
  chip: { minHeight: 48, borderRadius: 999, borderWidth: 1, justifyContent: "center", paddingHorizontal: 16 },
  chipText: { fontSize: 14, fontWeight: "700" },
  progressLabel: { flexDirection: "row", justifyContent: "space-between" },
  track: { height: 8, overflow: "hidden", borderRadius: 999, marginTop: 8 },
  fill: { height: "100%", borderRadius: 999 },
  ring: { width: 128, height: 128, borderRadius: 64, borderWidth: 12, justifyContent: "center", alignItems: "center" },
  ringValue: { fontSize: 32, fontWeight: "800" },
  ringLabel: { fontSize: 11, fontWeight: "700" },
  state: { minHeight: 160, borderWidth: 1, borderStyle: "dashed", borderRadius: 16, padding: 24, alignItems: "center", justifyContent: "center", gap: 12 },
  stateTitle: { fontSize: 18, fontWeight: "800" },
  skeleton: { borderRadius: 16 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  loading: { minHeight: 160, alignItems: "center", justifyContent: "center", gap: 12 },
  toast: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
});
