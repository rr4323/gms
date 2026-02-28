/**
 * SVG Donut Chart component.
 */
export default function DonutChart({ segments = [], size = 160, centerText = '', centerLabel = '' }) {
    const strokeWidth = 24;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const cx = size / 2;
    const cy = size / 2;

    const total = segments.reduce((sum, s) => sum + (s.value || 0), 0);
    let accumulated = 0;

    return (
        <div className="donut-chart" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background circle */}
                <circle
                    cx={cx} cy={cy} r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={strokeWidth}
                />
                {total > 0 && segments.map((seg, i) => {
                    const pct = seg.value / total;
                    const dashLength = pct * circumference;
                    const dashOffset = -(accumulated * circumference) + circumference * 0.25;
                    accumulated += pct;

                    return (
                        <circle
                            key={i}
                            cx={cx} cy={cy} r={radius}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease' }}
                        />
                    );
                })}
            </svg>
            <div className="center-text">
                <div className="value">{centerText}</div>
                {centerLabel && <div className="label">{centerLabel}</div>}
            </div>
        </div>
    );
}
