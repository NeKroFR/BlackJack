// Data-visualization barrel. Custom inline-SVG charts, themeable + colorblind
// safe via the CSS chart tokens. Import from '../ui/charts'.

export { StatTile } from './StatTile'
export type { StatTileProps, StatTileTrend, StatDeltaTone } from './StatTile'

export { Sparkline } from './Sparkline'
export type { SparklineProps } from './Sparkline'

export { LineChart } from './LineChart'
export type { LineChartProps, LineSeries } from './LineChart'

export { BarChart } from './BarChart'
export type { BarChartProps, BarDatum } from './BarChart'

export { StrategyChart, StrategyLegend } from './StrategyChart'
export type { StrategyChartProps, StrategyCellInfo } from './StrategyChart'

export {
  CHART_TOKENS,
  chartColor,
  tint,
  ACTION_STYLE,
  ACTION_ORDER,
} from './palette'
export type { ActionStyle } from './palette'
