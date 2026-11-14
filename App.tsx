import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  StyleSheet,
  StatusBar,
  Dimensions,
  Animated,
  Easing,
  Vibration,
  Platform,
  SafeAreaView,
} from 'react-native';
import Svg, {
  Circle,
  Path,
  Line,
  G,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  ClipPath,
  Mask,
  Polyline,
} from 'react-native-svg';

/* ============================================================
   GluQuili — Metabolic balance at a glance
   Single-file Expo (React Native) app.
   Run on Expo Go, iOS Simulator, Android Emulator, or Expo Web.
   ============================================================ */

// ---------------- THEMES ----------------
type ThemeKey = 'homeostasis' | 'organic' | 'neon';
type Theme = {
  name: string;
  tagline: string;
  primary: string;
  secondary: string;
  bg: string;
  bg2: string;
  alert: string;
  text: string;
  textDim: string;
};
const THEMES: Record<ThemeKey, Theme> = {
  homeostasis: {
    name: 'Homeostasis',
    tagline: 'Cool · Clinical Trust',
    primary: '#2DD4BF',
    secondary: '#64748B',
    bg: '#0F172A',
    bg2: '#1E293B',
    alert: '#FB7185',
    text: '#E2E8F0',
    textDim: '#94A3B8',
  },
  organic: {
    name: 'Organic Balance',
    tagline: 'Earthy · Grounding',
    primary: '#86EFAC',
    secondary: '#D4D4D8',
    bg: '#18181B',
    bg2: '#27272A',
    alert: '#F97316',
    text: '#F4F4F5',
    textDim: '#A1A1AA',
  },
  neon: {
    name: 'Neon Ambient',
    tagline: 'AMOLED · High-Contrast',
    primary: '#818CF8',
    secondary: '#3F3F46',
    bg: '#000000',
    bg2: '#0A0A0A',
    alert: '#22D3EE',
    text: '#FAFAFA',
    textDim: '#71717A',
  },
};

// ---------------- MODES ----------------
type ModeKey = 'prebolus' | 'iob' | 'postmeal' | 'hypo' | 'fasting';
type Mode = {
  key: ModeKey;
  name: string;
  short: string;
  duration: number;
  subtitle: string;
  privacyName: string;
  metrics: { label: string; value: string; privacy: string; dim: string }[];
  glanceLabel: string;
};
const MODES: Record<ModeKey, Mode> = {
  prebolus: {
    key: 'prebolus',
    name: 'Pre-Bolus Timer',
    short: 'Pre-Bolus',
    duration: 15 * 60,
    subtitle: 'Insulin onset before meal',
    privacyName: 'Equilibrium Window A',
    metrics: [
      { label: 'Bolus Dose', value: '4.2 u', privacy: 'Metric α', dim: '14g carbs' },
      { label: 'Next Meal', value: 'Lunch', privacy: 'Event B', dim: 'Chicken & rice' },
    ],
    glanceLabel: 'Pre-Bolus',
  },
  iob: {
    key: 'iob',
    name: 'Active Insulin (IOB)',
    short: 'Active Insulin',
    duration: 3 * 60 * 60 + 30 * 60,
    subtitle: 'Insulin action remaining',
    privacyName: 'Metabolic Window B',
    metrics: [
      { label: 'IOB Remaining', value: '1.8 u', privacy: 'Metric β', dim: 'from 2.6 u' },
      { label: 'Last Glucose', value: '142 mg/dL', privacy: 'Reading C', dim: '↘ falling' },
    ],
    glanceLabel: 'IOB Decay',
  },
  postmeal: {
    key: 'postmeal',
    name: 'Post-Meal Check',
    short: 'Post-Meal',
    duration: 2 * 60 * 60,
    subtitle: '2-hour glucose verification',
    privacyName: 'Equilibrium Window C',
    metrics: [
      { label: 'Last Reading', value: '128 mg/dL', privacy: 'Reading D', dim: 'after meal' },
      { label: 'Target', value: '< 180 mg/dL', privacy: 'Threshold E', dim: '2-hour peak' },
    ],
    glanceLabel: '2hr Check',
  },
  hypo: {
    key: 'hypo',
    name: '15/15 Hypo Recovery',
    short: 'Hypo 15/15',
    duration: 15 * 60,
    subtitle: '15g carbs · recheck in 15 min',
    privacyName: 'Recovery Window',
    metrics: [
      { label: 'Trigger Reading', value: '58 mg/dL', privacy: 'Low Event', dim: 'treated: 15g' },
      { label: 'Treatment', value: '4 Glucose Tabs', privacy: 'Intake α', dim: 'logged 09:36' },
    ],
    glanceLabel: 'Hypo 15/15',
  },
  fasting: {
    key: 'fasting',
    name: 'Intermittent Fasting',
    short: 'Fasting',
    duration: 16 * 60 * 60,
    subtitle: 'Fasting to feeding window',
    privacyName: 'Routine Window',
    metrics: [
      { label: 'Fasting Window', value: '14h 20m', privacy: 'Window A', dim: 'of 16h goal' },
      { label: 'Last Glucose', value: '98 mg/dL', privacy: 'Reading F', dim: '↗ steady' },
    ],
    glanceLabel: 'Fasting',
  },
};
const MODE_LIST: ModeKey[] = ['prebolus', 'iob', 'postmeal', 'hypo', 'fasting'];

// ---------------- HELPERS ----------------
function fmt(sec: number): string {
  const s = Math.abs(Math.floor(sec));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hh > 0) return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  return `${pad(mm)}:${pad(ss)}`;
}
const tabularFont: any = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

// ---------------- SVG ICONS ----------------
function DropletIcon({ progress, color, size = 36 }: { progress: number; color: string; size?: number }) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <ClipPath id="dropClip">
          <Rect x={0} y={48 - 48 * p} width={48} height={48 * p} />
        </ClipPath>
      </Defs>
      <Path
        d="M24 4 C24 4 8 22 8 32 A16 16 0 0 0 40 32 C40 22 24 4 24 4 Z"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinejoin="round"
        opacity={0.9}
      />
      <Path
        d="M24 4 C24 4 8 22 8 32 A16 16 0 0 0 40 32 C40 22 24 4 24 4 Z"
        fill={color}
        opacity={0.85}
        clipPath="url(#dropClip)"
      />
    </Svg>
  );
}
function ActionCurveIcon({ progress, color, size = 36 }: { progress: number; color: string; size?: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const cometX = 6 + 36 * p;
  const curveY = 30 - 18 * Math.sin(Math.PI * p);
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M6 32 Q 20 2 42 32" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" opacity={0.35} />
      <Path
        d={`M6 32 Q 20 2 ${cometX} ${curveY}`}
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        opacity={0.9 - p * 0.5}
      />
      <Circle cx={cometX} cy={curveY} r={6} fill={color} opacity={(1 - p) * 0.25} />
      <Circle cx={cometX} cy={curveY} r={3.2} fill={color} opacity={1 - p * 0.6} />
    </Svg>
  );
}
function OrbitIcon({ progress, color, size = 36 }: { progress: number; color: string; size?: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const angle = -90 + 360 * p;
  const rad = (angle * Math.PI) / 180;
  const cx = 24 + 16 * Math.cos(rad);
  const cy = 24 + 16 * Math.sin(rad);
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx={24} cy={24} r={16} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} />
      <Circle cx={24} cy={24} r={3} fill={color} opacity={0.85} />
      <Line x1={24} y1={24} x2={cx} y2={cy} stroke={color} strokeWidth={1.4} opacity={0.55} />
      <Circle cx={cx} cy={cy} r={3.6} fill={color} />
      {[0, 1, 2, 3].map((i) => {
        const a = -90 + i * 90;
        const x1 = 24 + 16 * Math.cos((a * Math.PI) / 180);
        const y1 = 24 + 16 * Math.sin((a * Math.PI) / 180);
        const x2 = 24 + 18 * Math.cos((a * Math.PI) / 180);
        const y2 = 24 + 18 * Math.sin((a * Math.PI) / 180);
        return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5} opacity={0.6} />;
      })}
    </Svg>
  );
}
function SparkIcon({ progress, color, size = 36 }: { progress: number; color: string; size?: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const peakY = 38 - 28 * p;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d={`M6 42 Q 24 ${peakY} 42 42`}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        opacity={0.4}
      />
      <Path
        d={`M6 42 Q 18 ${peakY + 4} 24 ${peakY}`}
        fill="none"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Polyline
        points={`20,${peakY + 2} 24,${peakY - 4} 28,${peakY + 2}`}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={24} cy={peakY - 4} r={2.5} fill={color} />
    </Svg>
  );
}
function EclipseIcon({ progress, color, size = 36 }: { progress: number; color: string; size?: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const offset = -16 + 32 * p;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <Mask id="eclipseMask">
          <Rect x={0} y={0} width={48} height={48} fill="white" />
          <Circle cx={24 + offset} cy={24} r={14} fill="black" />
        </Mask>
      </Defs>
      <Circle cx={24} cy={24} r={14} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} />
      <Circle cx={24} cy={24} r={14} fill={color} mask="url(#eclipseMask)" opacity={0.9} />
    </Svg>
  );
}
function ModeIcon({ modeKey, progress, color, size }: { modeKey: ModeKey; progress: number; color: string; size?: number }) {
  switch (modeKey) {
    case 'prebolus':
      return <DropletIcon progress={progress} color={color} size={size} />;
    case 'iob':
      return <ActionCurveIcon progress={progress} color={color} size={size} />;
    case 'postmeal':
      return <OrbitIcon progress={progress} color={color} size={size} />;
    case 'hypo':
      return <SparkIcon progress={progress} color={color} size={size} />;
    case 'fasting':
      return <EclipseIcon progress={progress} color={color} size={size} />;
  }
}

// Status + UI icons
const LockIcon = ({ color, open = false, size = 14 }: { color: string; open?: boolean; size?: number }) =>
  open ? (
    <Svg viewBox="0 0 16 16" width={size} height={size}>
      <Path d="M4 7 V 4.5 A 3.5 3.5 0 0 1 10.5 3" fill="none" stroke={color} strokeWidth={1.4} />
      <Rect x={3} y={7} width={10} height={7} rx={1.5} fill="none" stroke={color} strokeWidth={1.4} />
      <Circle cx={8} cy={10.5} r={0.8} fill={color} />
    </Svg>
  ) : (
    <Svg viewBox="0 0 16 16" width={size} height={size}>
      <Path d="M4.5 7 V 4.5 A 3.5 3.5 0 0 1 11.5 4.5 V 7" fill="none" stroke={color} strokeWidth={1.4} />
      <Rect x={3} y={7} width={10} height={7} rx={1.5} fill="none" stroke={color} strokeWidth={1.4} />
      <Circle cx={8} cy={10.5} r={0.8} fill={color} />
    </Svg>
  );
const DropUIIcon = ({ color, size = 22 }: { color: string; size?: number }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    <Path
      d="M12 3 S4 12 4 17 a 8 8 0 0 0 16 0 C 20 12 12 3 12 3 Z"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </Svg>
);
const EyeIcon = ({ color, off, size = 22 }: { color: string; off?: boolean; size?: number }) =>
  off ? (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M2 12 S 6 5 12 5 c 2.5 0 4.7 1 6.5 2.3" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M22 12 S 20 15 17 17" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={4} y1={4} x2={20} y2={20} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={3} fill="none" stroke={color} strokeWidth={1.8} />
    </Svg>
  ) : (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M2 12 S 6 5 12 5 s 10 7 10 7 s -4 7 -10 7 S 2 12 2 12 Z" fill="none" stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={3} fill="none" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
const CheckIcon = ({ color, size = 14 }: { color: string; size?: number }) => (
  <Svg viewBox="0 0 16 16" width={size} height={size}>
    <Polyline
      points="3,8.5 7,12 13,4"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
const BluetoothIcon = ({ color, size = 22 }: { color: string; size?: number }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    <Path
      d="M8 7 L 16 17 L 12 20 V 4 L 16 7 L 8 17"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
const ArrowIcon = ({ dir, color, size = 12 }: { dir: string; color: string; size?: number }) => {
  if (dir === 'steady' || dir === 'flat') {
    return (
      <Svg viewBox="0 0 16 16" width={size} height={size}>
        <Line x1={2} y1={8} x2={14} y2={8} stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }
  const rot = dir === 'up' ? -45 : dir === 'down' ? 45 : 0;
  return (
    <View style={{ transform: [{ rotate: `${rot}deg` }] }}>
      <Svg viewBox="0 0 16 16" width={size} height={size}>
        <Line x1={2} y1={8} x2={14} y2={8} stroke={color} strokeWidth={2} strokeLinecap="round" />
        <Polyline
          points="10,4 14,8 10,12"
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

// ---------------- RING ----------------
function EquilibriumRing({
  progress,
  color,
  remainingText,
  modeKey,
  overdue,
  size = 146,
}: {
  progress: number;
  color: string;
  remainingText: string;
  modeKey: ModeKey;
  overdue: boolean;
  size?: number;
}) {
  const r = size / 2 - 15;
  const C = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const dash = C * (1 - p);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={7} />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={7}
            strokeDasharray={`${C}`}
            strokeDashoffset={dash}
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <View style={{ position: 'absolute', top: -4 }}>
        <ModeIcon modeKey={modeKey} progress={p} color={color} size={32} />
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color, fontSize: 22, fontWeight: '600', fontFamily: tabularFont }}>{remainingText}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, letterSpacing: 2, marginTop: 4 }}>
          {overdue ? 'OVERDUE' : 'REMAINING'}
        </Text>
      </View>
    </View>
  );
}

// ---------------- INITIAL DATA ----------------
type Milestone = { id: string; time: string; labelFull: string; labelPrivate: string; detail: string; status: 'done' | 'active' | 'upcoming' };
type LogEntry = { id: string; kind: 'glucose' | 'weight'; value: number; unit: string; trend?: string; ts: string };
function initMilestones(): Milestone[] {
  return [
    { id: 'm1', time: '08:00 AM', labelFull: 'Fasting Glucose Check', labelPrivate: 'Window A1', detail: '104 mg/dL', status: 'done' },
    { id: 'm2', time: '12:45 PM', labelFull: 'Pre-Lunch Bolus Wait', labelPrivate: 'Window A2', detail: '15 m', status: 'active' },
    { id: 'm3', time: '02:45 PM', labelFull: '2hr Post-Meal Check', labelPrivate: 'Window A3', detail: 'Target < 180', status: 'upcoming' },
    { id: 'm4', time: '09:30 PM', labelFull: 'Basal Insulin Dose', labelPrivate: 'Window A4', detail: '18 u', status: 'upcoming' },
  ];
}
function initLogs(): LogEntry[] {
  return [
    { id: 'l1', kind: 'glucose', value: 104, unit: 'mg/dL', trend: 'steady', ts: '08:00' },
    { id: 'l2', kind: 'weight', value: 74.5, unit: 'kg', ts: '07:12' },
    { id: 'l3', kind: 'glucose', value: 128, unit: 'mg/dL', trend: 'up', ts: '12:45' },
  ];
}

// ============================================================
//                          APP
// ============================================================
export default function App() {
  const [themeKey, setThemeKey] = useState<ThemeKey>('homeostasis');
  const theme = THEMES[themeKey];

  const [modeKey, setModeKey] = useState<ModeKey>('prebolus');
  const mode = MODES[modeKey];

  const [remaining, setRemaining] = useState<number>(MODES.prebolus.duration);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [privacy, setPrivacy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const [lastGlucose, setLastGlucose] = useState({ value: 118, unit: 'mg/dL', trend: 'steady' });
  const [milestones, setMilestones] = useState<Milestone[]>(initMilestones);
  const [logs, setLogs] = useState<LogEntry[]>(initLogs);

  const [screen, setScreen] = useState<'lock' | 'app'>('lock');
  const [tab, setTab] = useState<'timers' | 'milestones' | 'equipment' | 'themes'>('timers');

  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showFaceId, setShowFaceId] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [clockTime, setClockTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const clockDate = useMemo(() => {
    const d = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setClockTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }, 20000);
    return () => clearInterval(t);
  }, []);

  // Timer tick
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    const id = setInterval(() => {
      if (runningRef.current) {
        setRemaining((prev) => prev - speedRef.current);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const switchMode = useCallback((key: ModeKey) => {
    setModeKey(key);
    setRemaining(MODES[key].duration);
    setAcknowledged(false);
    setRunning(true);
  }, []);

  const overdue = remaining <= 0 && !acknowledged;
  const isAlert = overdue || (!acknowledged && remaining > 0 && remaining < Math.max(10, mode.duration * 0.05));
  const progress = useMemo(() => {
    if (mode.duration <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - Math.max(0, remaining) / mode.duration));
  }, [remaining, mode.duration]);
  const ringColor = isAlert ? theme.alert : theme.primary;
  const remainingDisplay = overdue ? `+${fmt(-remaining)}` : fmt(Math.max(0, remaining));

  // Vibrate on overdue entry + pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const wasOverdue = useRef(false);
  useEffect(() => {
    if (overdue && !wasOverdue.current) {
      try {
        Vibration.vibrate([0, 40, 60, 40]);
      } catch (e) {}
      wasOverdue.current = true;
    }
    if (!overdue) wasOverdue.current = false;
  }, [overdue]);
  useEffect(() => {
    if (overdue && !acknowledged) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [overdue, acknowledged]);

  const handleAck = () => {
    setAcknowledged(true);
    setRunning(false);
    setRemaining(mode.duration);
  };
  const handleSnooze = () => {
    setRemaining(5 * 60);
    setAcknowledged(false);
    setRunning(true);
  };
  const handleReset = () => {
    setRemaining(mode.duration);
    setAcknowledged(false);
    setRunning(true);
  };
  const handleJump = () => {
    setRemaining(3);
    setAcknowledged(false);
    setRunning(true);
  };

  const toggleMilestone = (id: string) => {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        if (m.status === 'done') return { ...m, status: 'upcoming' };
        return { ...m, status: 'done' };
      })
    );
  };
  const promoteMilestone = (id: string) => {
    setMilestones((prev) =>
      prev.map((m) => ({ ...m, status: m.id === id ? 'active' : m.status === 'active' ? 'upcoming' : m.status }))
    );
  };

  const simulateSync = () => {
    setSyncing(true);
    setTimeout(() => {
      const v = 102 + Math.floor(Math.random() * 40);
      const trends = ['steady', 'up', 'down'];
      const t = trends[Math.floor(Math.random() * trends.length)];
      setLastGlucose({ value: v, unit: 'mg/dL', trend: t });
      setLogs((prev) =>
        [{ id: 'l' + Date.now(), kind: 'glucose', value: v, unit: 'mg/dL', trend: t, ts: clockTime } as LogEntry, ...prev].slice(0, 20)
      );
      setSyncing(false);
    }, 2000);
  };

  const logGlucose = (value: number, unit: string) => {
    setLastGlucose({ value, unit, trend: 'steady' });
    setLogs((prev) =>
      [{ id: 'l' + Date.now(), kind: 'glucose', value, unit, trend: 'steady', ts: clockTime } as LogEntry, ...prev].slice(0, 20)
    );
    setMilestones((prev) => {
      const idx = prev.findIndex((m) => m.status !== 'done' && m.labelFull.toLowerCase().includes('check'));
      if (idx === -1) return prev;
      const copy = prev.slice();
      copy[idx] = { ...copy[idx], status: 'done' };
      return copy;
    });
  };
  const logWeight = (value: number, unit: string) => {
    setLogs((prev) => [{ id: 'l' + Date.now(), kind: 'weight', value, unit, ts: clockTime } as LogEntry, ...prev].slice(0, 20));
  };

  // Unlock sequence
  const screenAnim = useRef(new Animated.Value(0)).current; // 0 = lock, 1 = app
  const doUnlock = () => {
    if (showFaceId) return;
    setShowFaceId(true);
    try {
      Vibration.vibrate(20);
    } catch (e) {}
    setTimeout(() => {
      setShowFaceId(false);
      Animated.timing(screenAnim, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
        setScreen('app');
      });
    }, 1100);
  };
  const toLock = () => {
    Animated.timing(screenAnim, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      setScreen('lock');
    });
  };
  useEffect(() => {
    if (screen === 'lock') screenAnim.setValue(0);
    if (screen === 'app') screenAnim.setValue(1);
  }, [screen]);

  const commonCtx = {
    theme,
    themeKey,
    setThemeKey,
    mode,
    modeKey,
    switchMode,
    running,
    setRunning,
    speed,
    setSpeed,
    remaining,
    overdue,
    progress,
    remainingDisplay,
    isAlert,
    ringColor,
    privacy,
    setPrivacy,
    acknowledged,
    handleAck,
    handleSnooze,
    handleReset,
    handleJump,
    clockTime,
    clockDate,
    milestones,
    toggleMilestone,
    promoteMilestone,
    lastGlucose,
    simulateSync,
    syncing,
    logGlucose,
    logWeight,
    logs,
    setShowQuickLog,
    doUnlock,
    toLock,
    pulseAnim,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <SafeAreaView style={{ flex: 1 }}>
        {screen === 'lock' ? <LockScreen {...commonCtx} /> : <CompanionApp {...commonCtx} tab={tab} setTab={setTab} />}

        <Modal visible={showQuickLog} animationType="slide" transparent onRequestClose={() => setShowQuickLog(false)}>
          <QuickLogSheet
            theme={theme}
            onClose={() => setShowQuickLog(false)}
            onLogGlucose={(v, u) => {
              logGlucose(v, u);
              setShowQuickLog(false);
            }}
            onLogWeight={(v, u) => {
              logWeight(v, u);
              setShowQuickLog(false);
            }}
            onSync={simulateSync}
            syncing={syncing}
          />
        </Modal>

        <Modal visible={showFaceId} animationType="fade" transparent>
          <FaceIdOverlay theme={theme} />
        </Modal>
      </SafeAreaView>
    </View>
  );
}

// ============================================================
//                       LOCK SCREEN
// ============================================================
function LockScreen(ctx: any) {
  const {
    theme,
    mode,
    modeKey,
    overdue,
    acknowledged,
    progress,
    remainingDisplay,
    isAlert,
    ringColor,
    privacy,
    setPrivacy,
    handleAck,
    handleSnooze,
    clockTime,
    clockDate,
    milestones,
    toggleMilestone,
    lastGlucose,
    setShowQuickLog,
    doUnlock,
    pulseAnim,
  } = ctx;

  const dim = theme.textDim;
  const activeColor = isAlert ? theme.alert : theme.primary;
  const displayName = privacy ? mode.privacyName : mode.name;
  const barP = overdue ? 1 : progress;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Ambient background orbs (simple colored circles with high-opacity bg via View) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 60,
          left: -80,
          width: 260,
          height: 260,
          borderRadius: 999,
          backgroundColor: theme.primary,
          opacity: 0.18,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 120,
          right: -70,
          width: 220,
          height: 220,
          borderRadius: 999,
          backgroundColor: theme.alert,
          opacity: 0.1,
        }}
      />

      {/* Top ~22% status + clock */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '500' }}>GluQuili 5G</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BluetoothIcon color={theme.primary} size={12} />
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '500' }}>Wi-Fi</Text>
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '500', fontFamily: tabularFont }}>84%</Text>
          </View>
        </View>

        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <Text style={{ color: dim, fontSize: 14, fontWeight: '500' }}>{clockDate}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <LockIcon color={dim} open={!privacy} size={13} />
            <Text style={{ color: dim, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>
              {privacy ? 'Locked · Private' : 'Lock Screen'}
            </Text>
          </View>
          <Text
            style={{
              color: theme.text,
              fontSize: 76,
              fontWeight: '300',
              lineHeight: 82,
              marginTop: 2,
              letterSpacing: -2,
              fontFamily: tabularFont,
            }}
          >
            {clockTime}
          </Text>
        </View>
      </View>

      {/* Middle ~48% pill + widgets */}
      <View style={{ paddingHorizontal: 16, flex: 1, justifyContent: 'center', gap: 12 }}>
        {/* Live activity pill */}
        <Animated.View
          style={[
            styles.glass,
            {
              padding: 12,
              paddingHorizontal: 14,
              borderRadius: 22,
              borderColor: overdue ? `${theme.alert}55` : `${theme.primary}22`,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ModeIcon modeKey={modeKey} progress={progress} color={activeColor} size={32} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text numberOfLines={1} style={{ color: theme.text, fontSize: 12.5, fontWeight: '600', flex: 1 }}>
                  {privacy ? '••••••••••' : displayName}
                </Text>
                <Text style={{ color: activeColor, fontSize: 13, fontWeight: '600', fontFamily: tabularFont }}>
                  {remainingDisplay}
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                <View
                  style={{
                    height: '100%',
                    width: `${Math.min(100, barP * 100)}%`,
                    backgroundColor: overdue ? theme.alert : theme.primary,
                    borderRadius: 3,
                  }}
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 }}>
                <Text numberOfLines={1} style={{ color: dim, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', flex: 1 }}>
                  {overdue ? 'Time overdue' : privacy ? mode.privacyName : mode.subtitle}
                </Text>
                {overdue && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable
                      onPress={handleSnooze}
                      style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' }}
                    >
                      <Text style={{ color: theme.text, fontSize: 10, fontWeight: '600' }}>Snooze 5m</Text>
                    </Pressable>
                    <Pressable onPress={handleAck} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.alert }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>Log & Complete</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Widgets row */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[styles.glass, { flex: 1, borderRadius: 22, padding: 12, alignItems: 'center', justifyContent: 'center', height: 196 }]}>
            <EquilibriumRing progress={progress} color={ringColor} remainingText={remainingDisplay} modeKey={modeKey} overdue={overdue} />
            <Text style={{ color: dim, fontSize: 10, letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' }}>
              {privacy ? mode.privacyName : mode.glanceLabel}
            </Text>
          </View>

          <View style={[styles.glass, { flex: 1, borderRadius: 22, padding: 12, height: 196 }]}>
            <Text style={{ color: dim, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
              {privacy ? 'Metrics · hidden' : 'Metabolic dashboard'}
            </Text>
            <View style={{ flex: 1, gap: 8 }}>
              {mode.metrics.map((m: any, i: number) => (
                <View key={i} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: dim, fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                    {privacy ? m.privacy : m.label}
                  </Text>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', marginTop: 2, fontFamily: tabularFont }}>
                    {privacy ? '•• ••' : m.value}
                  </Text>
                  <Text style={{ color: dim, fontSize: 9.5, marginTop: 2 }}>{privacy ? '— — —' : m.dim}</Text>
                </View>
              ))}
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 8,
                backgroundColor: `${theme.primary}1a`,
                borderColor: `${theme.primary}33`,
                borderWidth: 1,
                borderRadius: 11,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary }} />
                <Text style={{ color: dim, fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                  {privacy ? 'Latest' : 'Last BG'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600', fontFamily: tabularFont }}>
                  {privacy ? '•••' : lastGlucose.value}
                </Text>
                {!privacy && <Text style={{ color: dim, fontSize: 10 }}>{lastGlucose.unit}</Text>}
                <ArrowIcon dir={lastGlucose.trend} color={theme.primary} />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Lower ~20% milestones */}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={[styles.glass, { borderRadius: 22, padding: 10, borderColor: `${theme.primary}1a` }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 6 }}>
            <Text style={{ color: dim, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Today · milestones</Text>
            <Text style={{ color: dim, fontSize: 10, fontFamily: tabularFont }}>
              {milestones.filter((m: Milestone) => m.status === 'done').length}/{milestones.length} done
            </Text>
          </View>
          <View style={{ gap: 4 }}>
            {milestones.map((m: Milestone) => {
              const isDone = m.status === 'done';
              const isActiveM = m.status === 'active';
              return (
                <Pressable
                  key={m.id}
                  onPress={() => toggleMilestone(m.id)}
                  style={{
                    backgroundColor: isActiveM ? `${theme.primary}22` : 'rgba(255,255,255,0.04)',
                    borderRadius: 13,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    opacity: isDone ? 0.5 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isDone ? theme.primary : isActiveM ? `${theme.primary}44` : 'rgba(255,255,255,0.08)',
                      borderWidth: 1,
                      borderColor: isDone ? theme.primary : 'rgba(255,255,255,0.12)',
                    }}
                  >
                    {isDone && <CheckIcon color="#000" size={11} />}
                    {!isDone && isActiveM && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary }} />}
                  </View>
                  <Text style={{ color: isActiveM ? theme.primary : dim, fontSize: 11, fontWeight: '600', width: 70, fontFamily: tabularFont }}>
                    {m.time}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: isDone ? dim : theme.text,
                      fontSize: 11,
                      flex: 1,
                      textDecorationLine: isDone ? 'line-through' : 'none',
                    }}
                  >
                    {privacy ? m.labelPrivate : m.labelFull}
                  </Text>
                  <Text style={{ color: dim, fontSize: 10, fontFamily: tabularFont }}>{privacy ? '—' : m.detail}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Bottom ~10% actions */}
      <View style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => setShowQuickLog(true)}
            style={[styles.glassStrong, { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }]}
          >
            <DropUIIcon color={theme.text} />
          </Pressable>

          <Pressable
            onPress={doUnlock}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <LockIcon color={theme.text} size={15} />
            <Text style={{ color: dim, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Tap to unlock</Text>
          </Pressable>

          <Pressable
            onPress={() => setPrivacy((p: boolean) => !p)}
            style={[
              styles.glassStrong,
              {
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: privacy ? theme.alert : 'rgba(255,255,255,0.14)',
              },
            ]}
          >
            <EyeIcon color={privacy ? theme.alert : theme.text} off={privacy} />
          </Pressable>
        </View>
        <View style={{ height: 5, width: 134, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)', alignSelf: 'center', marginTop: 14 }} />
      </View>
    </View>
  );
}

// ============================================================
//                    FACE ID OVERLAY
// ============================================================
function FaceIdOverlay({ theme }: { theme: Theme }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] });
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 24,
          borderWidth: 2,
          borderColor: theme.primary,
          backgroundColor: 'rgba(0,0,0,0.3)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Svg viewBox="0 0 64 64" width={64} height={64}>
          <Path d="M8 20 V 12 A 4 4 0 0 1 12 8 H 20" fill="none" stroke={theme.primary} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M56 20 V 12 A 4 4 0 0 0 52 8 H 44" fill="none" stroke={theme.primary} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M8 44 V 52 A 4 4 0 0 0 12 56 H 20" fill="none" stroke={theme.primary} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M56 44 V 52 A 4 4 0 0 1 52 56 H 44" fill="none" stroke={theme.primary} strokeWidth={2.2} strokeLinecap="round" />
          <Line x1={24} y1={24} x2={24} y2={28} stroke={theme.primary} strokeWidth={3} strokeLinecap="round" />
          <Line x1={40} y1={24} x2={40} y2={28} stroke={theme.primary} strokeWidth={3} strokeLinecap="round" />
          <Path d="M32 24 V 36 L 28 36" fill="none" stroke={theme.primary} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M24 42 c 2 3 5 4 8 4 s 6 -1 8 -4" fill="none" stroke={theme.primary} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: theme.primary,
            transform: [{ translateY }],
          }}
        />
      </View>
      <Text style={{ color: theme.primary, fontSize: 12, letterSpacing: 3, marginTop: 20, textTransform: 'uppercase' }}>
        FaceID · Authenticating
      </Text>
    </View>
  );
}

// ============================================================
//                    COMPANION APP
// ============================================================
function CompanionApp(ctx: any) {
  const { theme, tab, setTab, toLock } = ctx;
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
            <DropUIIcon color="#000" size={20} />
          </View>
          <View>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>GluQuili</Text>
            <Text style={{ color: theme.textDim, fontSize: 10 }}>Metabolic balance at a glance</Text>
          </View>
        </View>
        <Pressable
          onPress={toLock}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: `${theme.primary}22`,
            borderWidth: 1,
            borderColor: `${theme.primary}33`,
          }}
        >
          <LockIcon color={theme.primary} size={11} />
          <Text style={{ color: theme.primary, fontSize: 10, letterSpacing: 1.5, fontWeight: '600', textTransform: 'uppercase' }}>Lock</Text>
        </Pressable>
      </View>

      {/* Tab content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {tab === 'timers' && <TimersTab {...ctx} />}
        {tab === 'milestones' && <MilestonesTab {...ctx} />}
        {tab === 'equipment' && <EquipmentTab {...ctx} />}
        {tab === 'themes' && <ThemesTab {...ctx} />}
      </ScrollView>

      {/* Bottom tab bar */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme.bg2,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.08)',
          paddingBottom: 8,
        }}
      >
        {([
          { key: 'timers', label: 'Timers' },
          { key: 'milestones', label: 'Routine' },
          { key: 'equipment', label: 'Logs' },
          { key: 'themes', label: 'Themes' },
        ] as const).map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4 }}>
              <TabIcon kind={t.key} color={active ? theme.primary : theme.textDim} />
              <Text style={{ color: active ? theme.primary : theme.textDim, fontSize: 10, fontWeight: '600' }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabIcon({ kind, color, size = 20 }: { kind: string; color: string; size?: number }) {
  if (kind === 'timers')
    return (
      <Svg viewBox="0 0 24 24" width={size} height={size}>
        <Circle cx={12} cy={13} r={8} fill="none" stroke={color} strokeWidth={1.8} />
        <Path d="M12 13 V 8 M9 3 h 6" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  if (kind === 'milestones')
    return (
      <Svg viewBox="0 0 24 24" width={size} height={size}>
        <Path d="M4 6 h 16 M4 12 h 16 M4 18 h 10" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx={20} cy={18} r={2} fill="none" stroke={color} strokeWidth={1.8} />
      </Svg>
    );
  if (kind === 'equipment')
    return (
      <Svg viewBox="0 0 24 24" width={size} height={size}>
        <Path
          d="M3 13 h 4 l 2 -6 l 4 12 l 2 -6 h 6"
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  if (kind === 'themes')
    return (
      <Svg viewBox="0 0 24 24" width={size} height={size}>
        <Circle cx={12} cy={12} r={8} fill="none" stroke={color} strokeWidth={1.8} />
        <Path d="M12 4 v 16 M4 12 h 16" fill="none" stroke={color} strokeWidth={1.8} />
      </Svg>
    );
  return null;
}

// ============================================================
//                    TAB: TIMERS
// ============================================================
function TimersTab(ctx: any) {
  const {
    theme,
    modeKey,
    switchMode,
    mode,
    running,
    setRunning,
    speed,
    setSpeed,
    overdue,
    progress,
    remainingDisplay,
    isAlert,
    handleReset,
    handleJump,
    pulseAnim,
    acknowledged,
  } = ctx;
  const ringC = isAlert ? theme.alert : theme.primary;

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <SectionLabel theme={theme} text="Active timer" />
      <Animated.View
        style={{
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1,
          borderColor: overdue ? `${theme.alert}55` : `${theme.primary}22`,
          borderRadius: 16,
          padding: 16,
          marginTop: 8,
          transform: [{ scale: overdue && !acknowledged ? pulseAnim : 1 }],
        }}
      >
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <EquilibriumRing progress={progress} color={ringC} remainingText={remainingDisplay} modeKey={modeKey} overdue={overdue} size={128} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textDim, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {overdue ? 'Overdue' : 'Remaining'}
            </Text>
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: '600', fontFamily: tabularFont, marginTop: 4 }}>
              {remainingDisplay}
            </Text>
            <Text style={{ color: theme.textDim, fontSize: 11, marginTop: 6 }}>{mode.subtitle}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable
                onPress={() => setRunning((r: boolean) => !r)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: running ? theme.primary : 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: `${theme.primary}33`,
                }}
              >
                <Text style={{ color: running ? '#000' : theme.text, fontSize: 12, fontWeight: '600' }}>{running ? 'Pause' : 'Play'}</Text>
              </Pressable>
              <Pressable
                onPress={handleReset}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>Reset</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.06)',
            flexWrap: 'wrap',
          }}
        >
          <Text style={{ color: theme.textDim, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginRight: 4 }}>Speed</Text>
          <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}>
            {[1, 10, 60].map((s) => (
              <Pressable
                key={s}
                onPress={() => setSpeed(s)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 7,
                  backgroundColor: speed === s ? theme.primary : 'transparent',
                }}
              >
                <Text style={{ color: speed === s ? '#000' : theme.text, fontSize: 11, fontWeight: '600', fontFamily: tabularFont }}>{s}×</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={handleJump}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: `${theme.alert}22`,
              borderWidth: 1,
              borderColor: `${theme.alert}44`,
            }}
          >
            <Text style={{ color: theme.alert, fontSize: 11, fontWeight: '600' }}>Jump to 00:03 · test rebound</Text>
          </Pressable>
        </View>
      </Animated.View>

      <SectionLabel theme={theme} text="Presets" top />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
        {MODE_LIST.map((key) => {
          const m = MODES[key];
          const active = modeKey === key;
          return (
            <Pressable
              key={key}
              onPress={() => switchMode(key)}
              style={{
                width: '48%',
                backgroundColor: active ? `${theme.primary}1a` : 'rgba(255,255,255,0.04)',
                borderWidth: 1,
                borderColor: active ? theme.primary : 'rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: active ? `${theme.primary}22` : 'rgba(255,255,255,0.05)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ModeIcon modeKey={key} progress={0.45} color={active ? theme.primary : theme.textDim} size={28} />
                </View>
                {active && <View style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary }} />}
              </View>
              <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>{m.short}</Text>
              <Text style={{ color: theme.textDim, fontSize: 10, marginTop: 2, fontFamily: tabularFont }}>{fmt(m.duration)}</Text>
              <Text style={{ color: theme.textDim, fontSize: 9.5, marginTop: 4 }}>{m.subtitle}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================
//                    TAB: MILESTONES
// ============================================================
function MilestonesTab(ctx: any) {
  const { theme, milestones, toggleMilestone, promoteMilestone } = ctx;
  const [weekly] = useState([
    { id: 'w1', title: 'A1C lab visit', when: 'Thu 3:00 PM' },
    { id: 'w2', title: 'Pump reservoir change', when: 'Sun 09:00 AM' },
    { id: 'w3', title: 'Weight log', when: 'Mon 07:00 AM' },
  ]);
  const [monthly] = useState([
    { id: 'mo1', title: 'Endocrinologist appointment', when: 'Nov 22 · 11:30 AM' },
    { id: 'mo2', title: 'CGM sensor replacement', when: 'Nov 28 · 08:00 AM' },
  ]);

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <SectionLabel
        theme={theme}
        text="Today"
        badge={`${milestones.filter((m: Milestone) => m.status === 'done').length}/${milestones.length}`}
      />
      <View style={{ gap: 8, marginTop: 8 }}>
        {milestones.map((m: Milestone) => {
          const isDone = m.status === 'done';
          const isActive = m.status === 'active';
          return (
            <View
              key={m.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 16,
                backgroundColor: isActive ? `${theme.primary}14` : 'rgba(255,255,255,0.04)',
                borderWidth: 1,
                borderColor: isActive ? `${theme.primary}44` : 'rgba(255,255,255,0.08)',
                opacity: isDone ? 0.55 : 1,
              }}
            >
              <Pressable
                onPress={() => toggleMilestone(m.id)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDone ? theme.primary : 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: isDone ? theme.primary : 'rgba(255,255,255,0.12)',
                }}
              >
                {isDone && <CheckIcon color="#000" size={14} />}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600', textDecorationLine: isDone ? 'line-through' : 'none' }}>
                  {m.labelFull}
                </Text>
                <Text style={{ color: theme.textDim, fontSize: 11, marginTop: 2, fontFamily: tabularFont }}>
                  {m.time} · {m.detail}
                </Text>
              </View>
              <Pressable
                onPress={() => promoteMilestone(m.id)}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: theme.primary }}
              >
                <Text style={{ color: '#000', fontSize: 10, fontWeight: '600' }}>{isActive ? 'Active' : 'Start'}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <SectionLabel theme={theme} text="This week" top />
      <View style={{ gap: 8, marginTop: 8 }}>
        {weekly.map((w) => (
          <View
            key={w.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{w.title}</Text>
              <Text style={{ color: theme.textDim, fontSize: 11, marginTop: 2 }}>{w.when}</Text>
            </View>
          </View>
        ))}
      </View>

      <SectionLabel theme={theme} text="This month" top />
      <View style={{ gap: 8, marginTop: 8 }}>
        {monthly.map((mo) => (
          <View
            key={mo.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${theme.alert}18`,
                borderWidth: 1,
                borderColor: `${theme.alert}44`,
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.alert }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{mo.title}</Text>
              <Text style={{ color: theme.textDim, fontSize: 11, marginTop: 2 }}>{mo.when}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ============================================================
//                    TAB: EQUIPMENT / LOGS
// ============================================================
function EquipmentTab(ctx: any) {
  const { theme, logs, simulateSync, syncing, setShowQuickLog } = ctx;
  const glucoseLogs = logs.filter((l: LogEntry) => l.kind === 'glucose');
  const weightLogs = logs.filter((l: LogEntry) => l.kind === 'weight');
  const avg = glucoseLogs.length ? Math.round(glucoseLogs.reduce((a: number, b: LogEntry) => a + b.value, 0) / glucoseLogs.length) : 0;

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <SectionLabel theme={theme} text="Bluetooth equipment" />
      <View
        style={{
          marginTop: 8,
          padding: 16,
          borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1,
          borderColor: `${theme.primary}22`,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: `${theme.primary}22`,
              borderWidth: 1,
              borderColor: `${theme.primary}55`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BluetoothIcon color={theme.primary} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
              {syncing ? 'Scanning for devices…' : 'Dexcom G7 · CGM'}
            </Text>
            <Text style={{ color: theme.textDim, fontSize: 11, fontFamily: tabularFont }}>
              {syncing ? 'BLE discovery' : 'Paired · last sync just now'}
            </Text>
          </View>
          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: `${theme.primary}22` }}>
            <Text style={{ color: theme.primary, fontSize: 10, letterSpacing: 1, fontWeight: '600' }}>LIVE</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={simulateSync}
            disabled={syncing}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: syncing ? 'rgba(255,255,255,0.06)' : theme.primary,
            }}
          >
            <Text style={{ color: syncing ? theme.textDim : '#000', fontSize: 12, fontWeight: '600' }}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowQuickLog(true)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>Manual log</Text>
          </Pressable>
        </View>
      </View>

      <SectionLabel theme={theme} text="Glucose history" top badge={`avg ${avg}`} />
      <View
        style={{
          marginTop: 8,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {glucoseLogs.length ? (
          glucoseLogs.map((l: LogEntry, i: number) => (
            <View
              key={l.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary }} />
              <Text style={{ color: theme.textDim, fontSize: 11, width: 48, fontFamily: tabularFont }}>{l.ts}</Text>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600', flex: 1, fontFamily: tabularFont }}>
                {l.value} {l.unit}
              </Text>
              <ArrowIcon dir={l.trend || 'steady'} color={theme.primary} />
            </View>
          ))
        ) : (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ color: theme.textDim, fontSize: 12 }}>No glucose readings logged yet</Text>
          </View>
        )}
      </View>

      <SectionLabel theme={theme} text="Weight trend" top />
      <View
        style={{
          marginTop: 8,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {weightLogs.length ? (
          weightLogs.map((l: LogEntry, i: number) => (
            <View
              key={l.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.alert }} />
              <Text style={{ color: theme.textDim, fontSize: 11, width: 48, fontFamily: tabularFont }}>{l.ts}</Text>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600', flex: 1, fontFamily: tabularFont }}>
                {l.value} {l.unit}
              </Text>
            </View>
          ))
        ) : (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ color: theme.textDim, fontSize: 12 }}>No weight entries yet</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ============================================================
//                    TAB: THEMES
// ============================================================
function ThemesTab(ctx: any) {
  const { theme, themeKey, setThemeKey, privacy, setPrivacy, toLock } = ctx;
  const [nudges, setNudges] = useState(true);
  const [sound, setSound] = useState(false);

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <SectionLabel theme={theme} text="Theme palette" />
      <View style={{ gap: 10, marginTop: 8 }}>
        {(Object.entries(THEMES) as [ThemeKey, Theme][]).map(([key, t]) => {
          const active = themeKey === key;
          return (
            <Pressable
              key={key}
              onPress={() => setThemeKey(key)}
              style={{
                padding: 14,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: active ? `${t.primary}14` : 'rgba(255,255,255,0.04)',
                borderWidth: 1.5,
                borderColor: active ? t.primary : 'rgba(255,255,255,0.08)',
              }}
            >
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.primary }} />
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.alert }} />
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.bg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{t.name}</Text>
                <Text style={{ color: theme.textDim, fontSize: 11, marginTop: 2 }}>{t.tagline}</Text>
              </View>
              {active && (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: t.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckIcon color="#000" size={12} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <SectionLabel theme={theme} text="Smart alerts & privacy" top />
      <View style={{ gap: 8, marginTop: 8 }}>
        <ToggleRow theme={theme} title="Zero-touch rebound nudge" hint="Pulse alert color + haptic when a timer hits 00:00" value={nudges} onChange={setNudges} />
        <ToggleRow theme={theme} title="Sound at overdue" hint="Play a gentle chime on top of the pulse" value={sound} onChange={setSound} />
        <ToggleRow theme={theme} title="Privacy Blur default" hint="Hide medical words and numbers when locked" value={privacy} onChange={setPrivacy} />
      </View>

      <Pressable
        onPress={toLock}
        style={{
          marginTop: 24,
          paddingVertical: 16,
          borderRadius: 18,
          backgroundColor: theme.primary,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <LockIcon color="#000" size={16} />
        <Text style={{ color: '#000', fontSize: 14, fontWeight: '600' }}>Activate Lock Screen Mode</Text>
      </Pressable>

      <Text style={{ color: theme.textDim, fontSize: 10, textAlign: 'center', marginTop: 16 }}>
        GluQuili · metabolic balance at a glance
      </Text>
    </View>
  );
}

function ToggleRow({ theme, title, hint, value, onChange }: { theme: Theme; title: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: theme.textDim, fontSize: 11, marginTop: 2 }}>{hint}</Text>
      </View>
      <View
        style={{
          width: 44,
          height: 26,
          borderRadius: 999,
          backgroundColor: value ? theme.primary : 'rgba(255,255,255,0.12)',
          justifyContent: 'center',
          paddingHorizontal: 3,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#fff',
            alignSelf: value ? 'flex-end' : 'flex-start',
          }}
        />
      </View>
    </Pressable>
  );
}

function SectionLabel({ theme, text, top, badge }: { theme: Theme; text: string; top?: boolean; badge?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: top ? 24 : 16 }}>
      <Text style={{ color: theme.textDim, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase' }}>{text}</Text>
      {badge && (
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: `${theme.primary}18` }}>
          <Text style={{ color: theme.primary, fontSize: 10, fontFamily: tabularFont }}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

// ============================================================
//                    QUICK LOG SHEET (Modal)
// ============================================================
function QuickLogSheet({
  theme,
  onClose,
  onLogGlucose,
  onLogWeight,
  onSync,
  syncing,
}: {
  theme: Theme;
  onClose: () => void;
  onLogGlucose: (v: number, u: string) => void;
  onLogWeight: (v: number, u: string) => void;
  onSync: () => void;
  syncing: boolean;
}) {
  const [tab, setTab] = useState<'glucose' | 'weight' | 'sync'>('glucose');
  const [gluVal, setGluVal] = useState('118');
  const [gluUnit, setGluUnit] = useState<'mg/dL' | 'mmol/L'>('mg/dL');
  const [wVal, setWVal] = useState('74.5');
  const [wUnit, setWUnit] = useState<'kg' | 'lbs'>('kg');

  return (
    <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
      <Pressable
        onPress={() => {}}
        style={{
          backgroundColor: theme.bg2,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          paddingBottom: 24,
        }}
      >
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginTop: 10, marginBottom: 16 }} />
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>Quick log</Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: theme.textDim, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>Close</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {(['glucose', 'weight', 'sync'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: tab === t ? theme.primary : 'rgba(255,255,255,0.06)',
                }}
              >
                <Text style={{ color: tab === t ? '#000' : theme.text, fontSize: 11, letterSpacing: 1.2, fontWeight: '600', textTransform: 'uppercase' }}>
                  {t === 'glucose' ? 'Glucose' : t === 'weight' ? 'Weight' : 'CGM Sync'}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'glucose' && (
            <View>
              <Text style={{ color: theme.textDim, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Blood glucose</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 20 }}>
                <TextInput
                  value={gluVal}
                  onChangeText={setGluVal}
                  keyboardType="numeric"
                  style={{
                    color: theme.text,
                    fontSize: 42,
                    fontWeight: '600',
                    width: 160,
                    fontFamily: tabularFont,
                    borderBottomWidth: 1,
                    borderBottomColor: `${theme.primary}44`,
                    paddingVertical: 4,
                  }}
                />
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
                  {(['mg/dL', 'mmol/L'] as const).map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => setGluUnit(u)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: gluUnit === u ? theme.primary : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <Text style={{ color: gluUnit === u ? '#000' : theme.textDim, fontSize: 10, fontWeight: '600' }}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Pressable
                onPress={() => onLogGlucose(Number(gluVal), gluUnit)}
                style={{ paddingVertical: 14, borderRadius: 18, backgroundColor: theme.primary, alignItems: 'center' }}
              >
                <Text style={{ color: '#000', fontSize: 13, fontWeight: '600' }}>Log {gluVal} {gluUnit}</Text>
              </Pressable>
            </View>
          )}

          {tab === 'weight' && (
            <View>
              <Text style={{ color: theme.textDim, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Body weight</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 20 }}>
                <TextInput
                  value={wVal}
                  onChangeText={setWVal}
                  keyboardType="numeric"
                  style={{
                    color: theme.text,
                    fontSize: 42,
                    fontWeight: '600',
                    width: 160,
                    fontFamily: tabularFont,
                    borderBottomWidth: 1,
                    borderBottomColor: `${theme.primary}44`,
                    paddingVertical: 4,
                  }}
                />
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
                  {(['kg', 'lbs'] as const).map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => setWUnit(u)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: wUnit === u ? theme.primary : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <Text style={{ color: wUnit === u ? '#000' : theme.textDim, fontSize: 10, fontWeight: '600' }}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Pressable
                onPress={() => onLogWeight(Number(wVal), wUnit)}
                style={{ paddingVertical: 14, borderRadius: 18, backgroundColor: theme.primary, alignItems: 'center' }}
              >
                <Text style={{ color: '#000', fontSize: 13, fontWeight: '600' }}>Log {wVal} {wUnit}</Text>
              </Pressable>
            </View>
          )}

          {tab === 'sync' && (
            <View>
              <View
                style={{
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 16,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: `${theme.primary}22`,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: `${theme.primary}22`,
                      borderWidth: 1,
                      borderColor: `${theme.primary}55`,
                    }}
                  >
                    <BluetoothIcon color={theme.primary} size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
                      {syncing ? 'Scanning for devices…' : 'GluQuili CGM · Dexcom G7'}
                    </Text>
                    <Text style={{ color: theme.textDim, fontSize: 11 }}>
                      {syncing ? 'Bluetooth LE discovery' : 'Last synced 4m ago'}
                    </Text>
                  </View>
                </View>
              </View>
              <Pressable
                onPress={onSync}
                disabled={syncing}
                style={{
                  paddingVertical: 14,
                  borderRadius: 18,
                  alignItems: 'center',
                  backgroundColor: syncing ? 'rgba(255,255,255,0.08)' : theme.primary,
                }}
              >
                <Text style={{ color: syncing ? theme.textDim : '#000', fontSize: 13, fontWeight: '600' }}>
                  {syncing ? 'Syncing…' : 'Sync Bluetooth CGM'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </Pressable>
    </Pressable>
  );
}

// ============================================================
//                         STYLES
// ============================================================
const styles = StyleSheet.create({
  glass: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  glassStrong: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
});
