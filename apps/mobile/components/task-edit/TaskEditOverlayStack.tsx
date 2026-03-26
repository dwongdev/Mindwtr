import React from 'react';

import { AIResponseModal } from '../ai-response-modal';
import { TaskEditAreaPicker } from './TaskEditAreaPicker';
import { TaskEditCustomRecurrenceModal } from './TaskEditCustomRecurrenceModal';
import {
    TaskEditAudioModal,
    TaskEditImagePreviewModal,
    TaskEditLinkModal,
} from './TaskEditOverlayModals';
import { TaskEditProjectPicker } from './TaskEditProjectPicker';
import { TaskEditSectionPicker } from './TaskEditSectionPicker';

type TaskEditOverlayStackProps = {
    [key: string]: any;
};

export function TaskEditOverlayStack(props: TaskEditOverlayStackProps) {
    const {
        aiModal,
        applyCustomRecurrence,
        areas,
        audioAttachment,
        audioLoading,
        audioModalVisible,
        audioStatus,
        closeAIModal,
        closeAudioModal,
        closeImagePreview,
        closeLinkModal,
        confirmAddLink,
        customInterval,
        customMode,
        customMonthDay,
        customOrdinal,
        customRecurrenceVisible,
        customWeekday,
        filteredProjectsForPicker,
        imagePreviewAttachment,
        linkInput,
        linkInputTouched,
        linkModalVisible,
        projects,
        recurrenceWeekdayButtons,
        recurrenceWeekdayLabels,
        sectionPickerProjectId,
        setCustomInterval,
        setCustomMode,
        setCustomMonthDay,
        setCustomOrdinal,
        setCustomRecurrenceVisible,
        setCustomWeekday,
        setEditedTask,
        setLinkInput,
        setLinkInputTouched,
        showAreaPicker,
        showProjectPicker,
        showSectionPicker,
        t,
        tc,
        toggleAudioPlayback,
    } = props;

    return (
        <>
            <TaskEditLinkModal
                visible={linkModalVisible}
                t={t}
                tc={tc}
                linkInput={linkInput}
                linkInputTouched={linkInputTouched}
                onChangeLinkInput={(text: string) => {
                    setLinkInput(text);
                    setLinkInputTouched(true);
                }}
                onBlurLinkInput={() => setLinkInputTouched(true)}
                onClose={closeLinkModal}
                onSave={confirmAddLink}
            />
            <TaskEditAudioModal
                visible={audioModalVisible}
                t={t}
                tc={tc}
                audioTitle={audioAttachment?.title}
                audioStatus={audioStatus}
                audioLoading={audioLoading}
                onTogglePlayback={() => {
                    void toggleAudioPlayback();
                }}
                onClose={closeAudioModal}
            />
            <TaskEditImagePreviewModal
                visible={Boolean(imagePreviewAttachment)}
                t={t}
                tc={tc}
                imagePreviewAttachment={imagePreviewAttachment}
                onClose={closeImagePreview}
            />
            <TaskEditCustomRecurrenceModal
                visible={customRecurrenceVisible}
                t={t}
                tc={tc}
                styles={props.styles}
                customInterval={customInterval}
                setCustomInterval={setCustomInterval}
                customMode={customMode}
                setCustomMode={setCustomMode}
                customOrdinal={customOrdinal}
                setCustomOrdinal={setCustomOrdinal}
                customWeekday={customWeekday}
                setCustomWeekday={setCustomWeekday}
                customMonthDay={customMonthDay}
                setCustomMonthDay={setCustomMonthDay}
                recurrenceWeekdayButtons={recurrenceWeekdayButtons}
                recurrenceWeekdayLabels={recurrenceWeekdayLabels}
                onClose={() => setCustomRecurrenceVisible(false)}
                onSave={applyCustomRecurrence}
            />
            <TaskEditProjectPicker
                visible={showProjectPicker}
                projects={filteredProjectsForPicker}
                allProjects={projects}
                tc={tc}
                t={t}
                onClose={() => props.setShowProjectPicker(false)}
                onSelectProject={(projectId: string) => {
                    setEditedTask((prev: any) => ({
                        ...prev,
                        projectId,
                        areaId: projectId ? undefined : prev.areaId,
                        sectionId: projectId && prev.projectId === projectId ? prev.sectionId : undefined,
                    }));
                }}
                onAddProject={async (title: string) => {
                    const created = await props.addProject(title, props.DEFAULT_PROJECT_COLOR, props.projectFilterAreaId ? { areaId: props.projectFilterAreaId } : undefined);
                    if (created?.id) {
                        setEditedTask((prev: any) => ({
                            ...prev,
                            projectId: created.id,
                            areaId: undefined,
                            sectionId: undefined,
                        }));
                    }
                }}
            />
            <TaskEditSectionPicker
                visible={showSectionPicker}
                projectId={sectionPickerProjectId}
                sections={props.sectionPickerSections}
                tc={tc}
                t={t}
                onClose={() => props.setShowSectionPicker(false)}
                onSelectSection={(sectionId: string) => {
                    setEditedTask((prev: any) => ({ ...prev, sectionId }));
                }}
                onAddSection={async (title: string) => {
                    const projectId = sectionPickerProjectId;
                    if (!projectId) return;
                    const created = await props.addSection(projectId, title);
                    if (created?.id) {
                        setEditedTask((prev: any) => ({ ...prev, sectionId: created.id }));
                    }
                }}
            />
            <TaskEditAreaPicker
                visible={showAreaPicker}
                areas={areas}
                tc={tc}
                t={t}
                onClose={() => props.setShowAreaPicker(false)}
                onSelectArea={(areaId: string | undefined) => {
                    setEditedTask((prev: any) => ({ ...prev, areaId }));
                }}
                onAddArea={async (name: string) => {
                    const created = await props.addArea(name);
                    if (created?.id) {
                        setEditedTask((prev: any) => ({ ...prev, areaId: created.id }));
                    }
                }}
            />
            <AIResponseModal
                visible={Boolean(aiModal)}
                title={aiModal?.title ?? ''}
                message={aiModal?.message}
                actions={aiModal?.actions ?? []}
                onClose={closeAIModal}
            />
        </>
    );
}
