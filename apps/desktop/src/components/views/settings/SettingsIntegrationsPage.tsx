import type { ExternalCalendarSubscription } from '@mindwtr/core';
import type { SystemCalendarPermissionStatus } from '../../../lib/system-calendar';

import { SettingsCalendarPage } from './SettingsCalendarPage';
import { SettingsObsidianSection } from './SettingsObsidianSection';

type Labels = {
    calendar: string;
    calendarDesc: string;
    calendarName: string;
    calendarUrl: string;
    calendarAdd: string;
    calendarRemove: string;
    externalCalendars: string;
    calendarSystemTitle: string;
    calendarSystemDesc: string;
    calendarSystemStatus: string;
    calendarSystemPermissionGranted: string;
    calendarSystemPermissionUndetermined: string;
    calendarSystemPermissionDenied: string;
    calendarSystemPermissionUnsupported: string;
    calendarSystemRequestAccess: string;
    calendarSystemDeniedHint: string;
    obsidianVault: string;
    obsidianVaultDesc: string;
    obsidianEnable: string;
    obsidianVaultPath: string;
    obsidianVaultPathHint: string;
    obsidianScanFolders: string;
    obsidianScanFoldersHint: string;
    obsidianInboxFile: string;
    obsidianInboxFileHint: string;
    obsidianWatching: string;
    obsidianWatcherUnavailable: string;
    obsidianSave: string;
    obsidianRemove: string;
    obsidianRescan: string;
    obsidianRescanning: string;
    obsidianLastScanned: string;
    obsidianNeverScanned: string;
    obsidianMissingMarker: string;
    browse: string;
};

type SettingsIntegrationsPageProps = {
    t: Labels;
    isTauri: boolean;
    newCalendarName: string;
    newCalendarUrl: string;
    calendarError: string | null;
    externalCalendars: ExternalCalendarSubscription[];
    showSystemCalendarSection: boolean;
    systemCalendarPermission: SystemCalendarPermissionStatus;
    onCalendarNameChange: (value: string) => void;
    onCalendarUrlChange: (value: string) => void;
    onAddCalendar: () => void;
    onToggleCalendar: (id: string, enabled: boolean) => void;
    onRemoveCalendar: (id: string) => void;
    onRequestSystemCalendarPermission: () => void;
    maskCalendarUrl: (url: string) => string;
    obsidianVaultPath: string;
    obsidianEnabled: boolean;
    obsidianScanFoldersText: string;
    obsidianInboxFile: string;
    obsidianLastScannedAt: string | null;
    obsidianHasVaultMarker: boolean | null;
    obsidianVaultWarning: string | null;
    obsidianIsWatching: boolean;
    obsidianWatcherError: string | null;
    isSavingObsidian: boolean;
    isScanningObsidian: boolean;
    onObsidianVaultPathChange: (value: string) => void;
    onObsidianEnabledChange: (value: boolean) => void;
    onObsidianScanFoldersTextChange: (value: string) => void;
    onObsidianInboxFileChange: (value: string) => void;
    onBrowseObsidianVault: () => Promise<void> | void;
    onSaveObsidian: () => Promise<void> | void;
    onRemoveObsidian: () => Promise<void> | void;
    onRescanObsidian: () => Promise<void> | void;
};

export function SettingsIntegrationsPage({
    t,
    isTauri,
    newCalendarName,
    newCalendarUrl,
    calendarError,
    externalCalendars,
    showSystemCalendarSection,
    systemCalendarPermission,
    onCalendarNameChange,
    onCalendarUrlChange,
    onAddCalendar,
    onToggleCalendar,
    onRemoveCalendar,
    onRequestSystemCalendarPermission,
    maskCalendarUrl,
    obsidianVaultPath,
    obsidianEnabled,
    obsidianScanFoldersText,
    obsidianInboxFile,
    obsidianLastScannedAt,
    obsidianHasVaultMarker,
    obsidianVaultWarning,
    obsidianIsWatching,
    obsidianWatcherError,
    isSavingObsidian,
    isScanningObsidian,
    onObsidianVaultPathChange,
    onObsidianEnabledChange,
    onObsidianScanFoldersTextChange,
    onObsidianInboxFileChange,
    onBrowseObsidianVault,
    onSaveObsidian,
    onRemoveObsidian,
    onRescanObsidian,
}: SettingsIntegrationsPageProps) {
    return (
        <div className="space-y-6">
            <SettingsCalendarPage
                t={t}
                newCalendarName={newCalendarName}
                newCalendarUrl={newCalendarUrl}
                calendarError={calendarError}
                externalCalendars={externalCalendars}
                showSystemCalendarSection={showSystemCalendarSection}
                systemCalendarPermission={systemCalendarPermission}
                onCalendarNameChange={onCalendarNameChange}
                onCalendarUrlChange={onCalendarUrlChange}
                onAddCalendar={onAddCalendar}
                onToggleCalendar={onToggleCalendar}
                onRemoveCalendar={onRemoveCalendar}
                onRequestSystemCalendarPermission={onRequestSystemCalendarPermission}
                maskCalendarUrl={maskCalendarUrl}
            />

            <SettingsObsidianSection
                t={t}
                isTauri={isTauri}
                obsidianVaultPath={obsidianVaultPath}
                obsidianEnabled={obsidianEnabled}
                obsidianScanFoldersText={obsidianScanFoldersText}
                obsidianInboxFile={obsidianInboxFile}
                obsidianLastScannedAt={obsidianLastScannedAt}
                obsidianHasVaultMarker={obsidianHasVaultMarker}
                obsidianVaultWarning={obsidianVaultWarning}
                obsidianIsWatching={obsidianIsWatching}
                obsidianWatcherError={obsidianWatcherError}
                isSavingObsidian={isSavingObsidian}
                isScanningObsidian={isScanningObsidian}
                onObsidianVaultPathChange={onObsidianVaultPathChange}
                onObsidianEnabledChange={onObsidianEnabledChange}
                onObsidianScanFoldersTextChange={onObsidianScanFoldersTextChange}
                onObsidianInboxFileChange={onObsidianInboxFileChange}
                onBrowseObsidianVault={onBrowseObsidianVault}
                onSaveObsidian={onSaveObsidian}
                onRemoveObsidian={onRemoveObsidian}
                onRescanObsidian={onRescanObsidian}
            />
        </div>
    );
}
