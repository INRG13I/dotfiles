import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"

// ==========================================
//               DROPDOWN MENUS
// ==========================================

function BatteryMenu() {
    // Poll the current power profile (using .trim() later to remove invisible terminal newlines)
    const activeProfile = createPoll("balanced", 2000, "bash -c 'powerprofilesctl get || echo balanced'")

    return (
        <box orientation={Gtk.Orientation.VERTICAL} spacing={10} class="system-menu">
            <button 
                onClicked={() => execAsync("powerprofilesctl set performance").catch(print)} 
                class={activeProfile.as(p => p.trim() === "performance" ? "pavu-btn active-btn" : "pavu-btn")}
            >
                <label label="Performance" />
            </button>
            <button 
                onClicked={() => execAsync("powerprofilesctl set balanced").catch(print)} 
                class={activeProfile.as(p => p.trim() === "balanced" ? "pavu-btn active-btn" : "pavu-btn")}
            >
                <label label="Balanced" />
            </button>
            <button 
                onClicked={() => execAsync("powerprofilesctl set power-saver").catch(print)} 
                class={activeProfile.as(p => p.trim() === "power-saver" ? "pavu-btn active-btn" : "pavu-btn")}
            >
                <label label="Power Saver" />
            </button>
        </box>
    )
}

function NetworkMenu() {
    const publicIp = createPoll("Fetching IP...", 1800000, "bash -c 'curl -s --connect-timeout 5 https://ifconfig.me || echo \"Offline\"'")
    const netSpeeds = createPoll("󰇚 0 KB/s  󰕒 0 KB/s", 1000, "bash -c \"dev=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'dev \\K\\S+' || echo lo); read -r c_d c_u < <(grep \\$dev /proc/net/dev | awk '{print \\$2, \\$10}'); read -r o_d o_u < <(cat /tmp/net_s 2>/dev/null || echo \\\"\\$c_d \\$c_u\\\"); echo \\\"\\$c_d \\$c_u\\\" > /tmp/net_s; echo \\\"󰇚 \\$(( (c_d - o_d) / 1024 )) KB/s   󰕒 \\$(( (c_u - o_u) / 1024 )) KB/s\\\"\"")

    return (
        <box orientation={Gtk.Orientation.VERTICAL} spacing={10} class="system-menu">
            <label label={publicIp} class="stats-text" halign={Gtk.Align.START} />
            <box class="separator" />
            <label label={netSpeeds} class="stats-text" />
            <box class="separator" />
            <button onClicked={() => execAsync("nm-connection-editor").catch(print)} class="pavu-btn">
                <label label="Open Network Manager" />
            </button>
        </box>
    )
}

function AudioMenu() {
    const track = createPoll("No media playing", 1000, "playerctl metadata --format '{{ title }} - {{ artist }}' 2>/dev/null || echo 'No media playing'")
    
    return (
        <box orientation={Gtk.Orientation.VERTICAL} spacing={12} class="system-menu">
            <box orientation={Gtk.Orientation.VERTICAL} spacing={4} class="graph-container">
                <label label={track} class="stats-text" halign={Gtk.Align.CENTER} />
                <box spacing={20} halign={Gtk.Align.CENTER} class="media-controls">
                    <button onClicked={() => execAsync("bash -c 'playerctl previous'").catch(print)} class="media-btn"><label label="󰒮" /></button>
                    <button onClicked={() => execAsync("bash -c 'playerctl play-pause'").catch(print)} class="media-btn play-btn"><label label="󰐊" /></button>
                    <button onClicked={() => execAsync("bash -c 'playerctl next'").catch(print)} class="media-btn"><label label="󰒭" /></button>
                </box>
            </box>
            <box class="separator" />
            <button onClicked={() => execAsync("pavucontrol").catch(print)} class="pavu-btn">
                <label label="Open Mixer (pavucontrol)" />
            </button>
        </box>
    )
}

function FanMenu() {
    const fanSpeed = createPoll("0 RPM", 2000, "bash -c \"grep 'speed:' /proc/acpi/ibm/fan | awk '{print \\$2}' || echo 'N/A'\"")
    const fanLevel = createPoll("auto", 2000, "bash -c \"grep 'level:' /proc/acpi/ibm/fan | awk '{print \\$2}' || echo 'auto'\"")
    
    return (
        <box orientation={Gtk.Orientation.VERTICAL} spacing={12} class="system-menu">
            <box spacing={10} halign={Gtk.Align.CENTER}>
                <label label="Current RPM:" class="stats-text" />
                <label label={fanSpeed.as(v => `${v} RPM`)} class="stats-text" />
            </box>
            <box spacing={10} halign={Gtk.Align.CENTER}>
                <label label="Current Level:" class="stats-text" />
                <label label={fanLevel} class="stats-text" />
            </box>
            
            <box spacing={10} halign={Gtk.Align.CENTER}>
                <button onClicked={() => execAsync("bash -c 'echo level auto | sudo tee /proc/acpi/ibm/fan'").catch(print)} class="pavu-btn">
                    <label label="Set to AUTO" />
                </button>
            </box>
            
            <box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                <Gtk.Scale 
                    orientation={Gtk.Orientation.HORIZONTAL} 
                    draw_value={true}
                    hexpand={true}
                    adjustment={new Gtk.Adjustment({ lower: 0, upper: 7, step_increment: 1, value: 3 })}
                    onValueChanged={(self) => {
                        const level = Math.round(self.get_value());
                        execAsync(`bash -c "echo level ${level} | sudo tee /proc/acpi/ibm/fan"`).catch(print);
                    }}
                />
            </box>
        </box>
    )
}


// ==========================================
//               MAIN BAR
// ==========================================

export default function Bar(gdkmonitor: Gdk.Monitor) {
    const time = createPoll("", 1000, "date '+%-d %b %H:%M'")
    const workspaces = createPoll("1", 200, "bash -c \"active=$(hyprctl activeworkspace -j | jq '.id'); hyprctl workspaces -j | jq -r 'map(.id) | sort | .[]' | awk -v act=\\\"$active\\\" '{if (\\$1 == act) printf \\\"[%s] \\\", \\$1; else printf \\\"%s \\\", \\$1}'\"")

    // One poll to rule them all - updates every 5 seconds
    const batteryData = createPoll({ percent: 0, status: "Discharging" }, 5000, 
        "bash -c \"cat /sys/class/power_supply/BAT0/capacity; cat /sys/class/power_supply/BAT0/status\"", 
        (out) => {
            const [p, s] = out.split('\n');
            return { 
                percent: parseInt(p) || 0, 
                status: s ? s.trim() : "Discharging" 
            };
        }
    )
    const netIcon = createPoll("", 5000, "bash -c \"dev=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'dev \\K\\S+' || echo ''); if echo \\\"\\$dev\\\" | grep -qE '^(en|eth)'; then echo '󰈀'; else echo ''; fi\"")
    const privIp = createPoll("Offline", 5000, "bash -c \"ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \\K\\S+' || echo Offline\"")

    // Added '|| echo 0%' so if grep fails, it doesn't crash the poll
    const volPct = createPoll("0%", 500, "bash -c \"amixer sget Master | grep -oP '\\[\\d+%\\]' | head -1 | tr -d '[]' || echo '0%'\"")
    const volIcon = createPoll("󰕾", 500, "bash -c \"amixer sget Master | grep -q '\\[off\\]' && echo '󰝟' || echo '󰕾'\"")
    const micIcon = createPoll("󰍬", 500, "bash -c \"amixer sget Capture | grep -q '\\[off\\]' && echo '󰍭' || echo '󰍬'\"")

    const ramRes = createPoll("0", 2000, "bash -c \"free | awk '/Mem:/ {printf \\\"%.0f\\\", \\$3/\\$2 * 100}'\"")
    const cpuRes = createPoll("0", 2000, "bash -c \"grep 'cpu ' /proc/stat | awk '{usage=(\\$2+\\$4)*100/(\\$2+\\$4+\\$5)} END {printf \\\"%d\\\", usage}'\"")
    const gpuRes = createPoll("0", 2000, "bash -c \"nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null || echo 0\"")

    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    return (
        <window visible name={`bar-${gdkmonitor}`} class="Bar" gdkmonitor={gdkmonitor} exclusivity={Astal.Exclusivity.EXCLUSIVE} anchor={TOP | LEFT | RIGHT} application={app}>
            <centerbox>
                {/* LEFT SIDE */}
                <box $type="start" halign={Gtk.Align.START} spacing={4} class="left-modules">
                    <menubutton class="module-btn">
                        <label label={time} />
                        <popover><Gtk.Calendar /></popover>
                    </menubutton>
                    <box class="module-btn workspace-box">
                        <label label={workspaces} />
                    </box>
                </box>

                <box $type="center" />

                {/* RIGHT SIDE */}
                <box $type="end" halign={Gtk.Align.END} spacing={4} class="right-modules">
                    
			{/* 8. Animated Fan (Nerd Font version) */}
                    <menubutton class="module-btn fan-box">
                        <label label="󰈐" class="animated-fan" />
                        <popover><FanMenu /></popover>
                    </menubutton>	

                    {/* 6 & 7. Unified Hardware Box (Click to open btop) */}
                    {/* Note: Change "kitty" below to "alacritty", "wezterm", etc. if you use a different terminal */}
                    <button class="module-btn system-box" onClicked={() => execAsync("kitty btop").catch(print)}>
                        <box spacing={8}>
                            <label label={cpuRes.as(v => ` ${v}%`)} />
                            <label label={gpuRes.as(v => `󰢮 ${v}%`)} />
                            <label label={ramRes.as(v => `󰘚 ${v}%`)} />
                        </box>
                    </button>

                    {/* 5. Audio & Mic */}
                    <menubutton class="module-btn audio-box">
                        <box spacing={8}>
                            <label label={micIcon} />
                            <label label={volIcon} />
                            <label label={volPct} />
                        </box>
                        <popover><AudioMenu /></popover>
                    </menubutton>

                    {/* 4. Network */}
                    <menubutton class="module-btn network-box">
                        <box spacing={10}>
                            <label label={netIcon} />
                            <label label={privIp} />
                        </box>
                        <popover><NetworkMenu /></popover>
                    </menubutton>

                    {/* 3. Battery */}
                    <menubutton class="module-btn battery-box">
                        <box spacing={4}>
                            <label 
                                class={batteryData.as(b => (b.percent <= 20 && b.status !== "Charging") ? "text-red" : "text-green")}
                                label={batteryData.as(b => {
                                    if (b.status === "Charging") return "󱐋";
                                    if (b.percent <= 10) return "󰂃";
                                    if (b.percent <= 20) return "󰁻";
                                    if (b.percent <= 50) return "󰁾";
                                    if (b.percent <= 80) return "󰂁";
                                    return "󰁹";
                                })}
                            />
                            <label 
                                label={batteryData.as(b => `${b.percent}%`)} 
                                class={batteryData.as(b => (b.percent <= 20 && b.status !== "Charging") ? "text-red" : "text-green")}
                            />
                        </box>
                        <popover><BatteryMenu /></popover>
                    </menubutton>

                </box>
            </centerbox>
        </window>
    )
}
