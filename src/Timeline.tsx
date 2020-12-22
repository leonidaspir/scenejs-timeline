//import PreactTimeline from "preact-timeline";
import PreactTimeline from "../packages/preact-timeline/dist/timeline.esm.js";
import EgComponent from "@egjs/component";
import { VNode, h, render, Component } from "preact";
import Scene, { SceneItem } from "scenejs";
import { TimelineProps, SelectEvent } from "./types";

export default class Timeline extends EgComponent {
    private timelineArea!: PreactTimeline;
    constructor(scene: Scene | SceneItem, parentElement: Element, options: TimelineProps = {}) {
        super();
        const element = document.createElement("div");
        render(
            <PreactTimeline
                ref={e => { e && (this.timelineArea = e as PreactTimeline) }}
                keyboard={true}
                {...options}
                scene={scene}
                onSelect={this.onSelect}
                onUpdate={this.onUpdate}
                onTrackAdded={this.onTrackAdded}
                onTrackRemoved={this.onTrackRemoved}
                onTogglePlay={this.onTogglePlay}
                onToggleRecord={this.onToggleRecord}
                onTimeUpdated={this.onTimeUpdated}
            />,
            element,
        );

        parentElement.appendChild(element.children[0]);
    }
    public update(isInit?: boolean) {
        this.timelineArea.update(isInit);
    }
    private onSelect = (e: SelectEvent) => {
        this.trigger("select", e);
    }
    private onUpdate = () => {
        this.trigger("update");
    }    
    private onTrackAdded = (e: SelectEvent) => {
        this.trigger("onTrackAdded", e);
    }
    private onTrackRemoved = (e: SelectEvent) => {
        this.trigger("onTrackRemoved", e);
    }    
    private onTogglePlay = (e: SelectEvent) => {
        this.trigger("onTogglePlay", e);
    }
    private onToggleRecord = (e: SelectEvent) => {
        this.trigger("onToggleRecord", e);
    }
    private onTimeUpdated = (e: SelectEvent) => {
        this.trigger("onTimeUpdated", e);
    }                              
}
