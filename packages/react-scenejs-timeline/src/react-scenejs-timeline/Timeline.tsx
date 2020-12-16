import { TimelineProps, TimelineState } from "./types";
import ControlArea from "./HeaderArea/ControlArea";
import HeaderArea from "./HeaderArea/HeaderArea";
import ScrollArea from "./ScrollArea/ScrollArea";
import * as React from "react";
import { CSS } from "./consts";
import {
    prefix,
    numberFormat,
    getTarget,
    findElementIndexByPosition,
    hasClass,
    flatObject,
    isScene,
} from "./utils";
import KeyController, { KeyControllerEvent } from "keycon";
import Scene, { SceneItem, ROLES } from "scenejs";
import Dragger from "@daybrush/drag";
import { dblCheck } from "./dblcheck";
import { getTimelineInfo } from "./TimelineInfo";
import {
    IObject,
    find,
    isUndefined,
    isObject,
    addEvent,
    removeEvent,
} from "@daybrush/utils";
import PureProps from "react-pure-props";
import styled from "react-css-styler";
import { ref } from "framework-utils";

const TimelineElement = styled("div", CSS);
export default class Timeline extends PureProps<TimelineProps, TimelineState> {
    public static defaultProps = {
        keyboard: true,
        onSelect: () => {},
        onTrackAdded: () => {},
        onTogglePlay: () => {},
        onToggleRecord: () => {},
        onTimeUpdated: () => {},
    };
    public draggers!: Dragger[];
    public headerArea!: HeaderArea;
    public controlArea!: ControlArea;
    public scrollArea!: ScrollArea;
    public values: IObject<any> = {};
    public state: TimelineState = {
        alt: false,
        zoom: 1,
        maxDuration: 0,
        maxTime: 10,
        timelineInfo: {},
        selectedProperty: "",
        selectedTime: -1,
        selectedItem: null,
        init: false,
        updateTime: false,
    };
    private pinchDragger!: Dragger;
    private keyMap: {
        keydown: IObject<(e: KeyControllerEvent) => any>;
        keyup: IObject<(e: KeyControllerEvent) => any>;
    } = {
        keydown: {
            alt: () => {
                this.setState({ alt: true });
            },
            space: ({ inputEvent }) => {
                inputEvent.preventDefault();
            },
            left: () => {
                this.prev();
            },
            right: () => {
                this.context();
            },
        },
        keyup: {
            alt: () => {
                this.setState({ alt: false });
            },
            esc: () => {
                this.finish();
            },
            backspace: () => {
                this.removeKeyframe(this.state.selectedProperty);
            },
            space: () => {
                this.togglePlay();
            },
        },
    };

    constructor(props: any) {
        super(props);

        this.state = {
            ...this.state,
            ...this.initScene(this.props.scene, false),
        };
    }
    public render() {
        const {
            scene,
            className,
            keyboard,
            onSelect,
            ...attributes
        } = this.props;
        const {
            zoom,
            alt,
            maxDuration,
            maxTime,
            timelineInfo,
            selectedProperty,
            selectedTime,
        } = this.state;

        return (
            <TimelineElement
                className={
                    prefix("timeline" + (alt ? " alt" : "")) +
                    (className ? ` ${className}` : "")
                }
                {...attributes}
            >
                <ControlArea
                    ref={ref(this, "controlArea")}
                    scene={scene}
                    timeline={this}
                />
                <HeaderArea
                    ref={ref(this, "headerArea")}
                    timeline={this}
                    maxDuration={maxDuration}
                    zoom={zoom}
                    maxTime={maxTime}
                    timelineInfo={timelineInfo}
                />

                <ScrollArea
                    ref={ref(this, "scrollArea")}
                    timeline={this}
                    maxDuration={maxDuration}
                    zoom={zoom}
                    maxTime={maxTime}
                    selectedProperty={selectedProperty}
                    selectedTime={selectedTime}
                    timelineInfo={timelineInfo}
                />
            </TimelineElement>
        );
    }
    public componentDidMount() {
        this.initWheelZoom();
        this.initScroll();
        this.initDragKeyframes();
        this.initKeyController();
    }
    public componentDidUpdate(prevProps: TimelineProps) {
        const scene = this.props.scene;
        const state = this.state;

        if (state.init) {
            state.init = false;
            this.scrollArea.foldAll();
        }
        if (prevProps.scene !== scene) {
            this.releaseScene(prevProps.scene);

            this.setState(this.initScene(scene, true));
        }
        if (state.updateTime) {
            state.updateTime = false;
            this.setTime();
        }
    }
    public componentWillUnmount() {
        this.draggers.forEach((dragger) => {
            dragger.unset();
        });
        this.pinchDragger.unset();
        const keycon = KeyController.global;
        const keyMap = this.keyMap;
        const keydownMap = keyMap.keydown;
        const keyupMap = keyMap.keyup;

        removeEvent(window, "blur", this.onBlur);

        keycon.offKeydown("alt", keydownMap.alt).offKeyup("alt", keyupMap.alt);

        if (this.props.keyboard) {
            keycon
                .offKeydown("space", keydownMap.space)
                .offKeydown("left", keydownMap.left)
                .offKeydown("right", keydownMap.right)
                .offKeyup("backspace", keyupMap.backspace)
                .offKeyup("esc", keyupMap.esc)
                .offKeyup("space", keyupMap.space);
        }
    }

    public update = (isInit: boolean = false, zoomUpdate: boolean = true) => {
        const scene = this.props.scene;

        if (!scene) {
            return;
        }

        const maxDuration = zoomUpdate
            ? Math.ceil(scene.getDuration()) + 1
            : this.state.maxDuration;
        //const maxDuration = 5;
        const maxTime = maxDuration;
        //const maxTime = Math.max(this.state.maxTime, maxDuration);
        //const currentMaxTime = this.state.maxTime;
        // const zoom = this.state.zoom;
        // const nextZoomScale = currentMaxTime > 1 ? maxTime / currentMaxTime : 1;
        // const nextZoom = Math.max(1, zoom * nextZoomScale);
        const nextZoom = 1;

        this.setState({
            timelineInfo: getTimelineInfo(scene),
            maxTime,
            maxDuration,
            updateTime: true,
            init: isInit,
            zoom: nextZoom,
        });
    };
    public prev = () => {
        const scene = this.props.scene;

        scene && this.setTime(scene.getTime() - 0.05);
    };
    public next() {
        const scene = this.props.scene;

        scene && this.setTime(scene.getTime() + 0.05);
    }
    public finish = () => {
        const scene = this.props.scene;

        scene && scene.finish();
    };
    public selectItem(scene: Scene | SceneItem) {
        const { timelineInfo, selectedTime } = this.state;

        for (const name in timelineInfo) {
            const info = timelineInfo[name];
            if (info.item === scene) {
                this.select(info.key, selectedTime);
                break;
            }
        }
    }
    public select(property: string, time: number = -1, isNotUpdate?: boolean) {
        const activeElement = document.activeElement;

        if (activeElement && (activeElement as any).blur) {
            (activeElement as any).blur();
        }
        const scene = this.props.scene;
        if (!scene) {
            return;
        }
        scene.pause();
        const state = this.state;
        const {
            selectedProperty: prevSelectedProperty,
            selectedTime: prevSelectedTime,
            selectedItem: prevSelectedItem,
            timelineInfo,
        } = state;
        const propertiesInfo = timelineInfo[property]!;
        const selectedItem = property ? propertiesInfo.item : this.props.scene!;
        const selectedName = property ? propertiesInfo.names.join("///") : "";

        if (this.props.onSelect) {
            this.props.onSelect({
                selectedItem,
                selectedName,
                selectedProperty: property,
                selectedTime: time,
                prevSelectedProperty,
                prevSelectedTime,
                prevSelectedItem,
            });
        }
        if (isNotUpdate) {
            state.selectedProperty = property;
            state.selectedTime = time;
            state.selectedItem = selectedItem;
        } else {
            this.setState({
                selectedProperty: property,
                selectedTime: time,
                selectedItem,
            });
        }
    }
    public editKeyframe(index: number, value: any) {
        const propertiesInfo = this.scrollArea.propertiesArea.properties[index]
            .props.propertiesInfo;
        // const isObjectData = propertiesInfo.isParent;

        // if (isObjectData) {
        //     return;
        // }
        const item = propertiesInfo.item;
        const properties = propertiesInfo.properties;

        item.set(item.getIterationTime(), ...properties, value);

        this.update();
    }
    public togglePlay = () => {
        const scene = this.props.scene;
        if (!scene) {
            return;
        }

        let playState: boolean;
        if (scene.getPlayState() === "running") {
            scene.pause();
            playState = false;
        } else {
            scene.play();
            playState = true;
        }

        if (this.props.onTogglePlay) {
            this.props.onTogglePlay(playState);
        }
    };
    public toggleRecord = (recordingState: boolean) => {
        if (this.props.onToggleRecord) {
            this.props.onToggleRecord(recordingState);
        }
    };
    public setTime(time?: number) {
        const scene = this.props.scene;

        if (!scene) {
            return;
        }
        const direction = scene.getDirection();

        scene.pause();

        if (isUndefined(time)) {
            time = scene.getTime();
        }

        let activeTime = time;
        if (direction === "normal" || direction === "alternate") {
            scene.setTime(time);
        } else {
            activeTime = scene.getDuration() - time!;
            scene.setTime(activeTime);
        }

        if (this.props.onTimeUpdated) {
            this.props.onTimeUpdated(activeTime);
        }
    }
    public setZoom(zoom: number) {
        this.setState({
            zoom: Math.max(zoom, 1),
        });
    }
    public getZoom() {
        return this.state.zoom;
    }
    public getValues() {
        return this.values;
    }
    public openDialog(
        item: Scene | SceneItem = this.props.scene!,
        properties: string[] = []
    ) {
        if (!this.props.scene) {
            return;
        }
        if (isScene(item)) {
            this.newItem(item);
        } else {
            this.newProperty(item, properties);
        }
    }
    public move(clientX: number) {
        this.setTime(this.getTime(clientX));
    }
    private newItem(scene: Scene) {
        const name = prompt("New Track Name");

        if (!name) {
            return;
        }

        const item = scene.newItem(name) as SceneItem;
        this.update();

        if (this.props.onTrackAdded) {
            this.props.onTrackAdded(item);
        }
    }
    private newProperty(item: SceneItem, properties: string[]) {
        const property = prompt("Add Property");

        if (!property) {
            return;
        }
        let roles: any = ROLES;

        const nextProperties = [...properties, property];
        const isRole = nextProperties.every((name) => {
            if (isObject(roles[name])) {
                roles = roles[name];
                return true;
            }
            return false;
        });

        item.set(item.getIterationTime(), ...nextProperties, isRole ? {} : "");
        this.update();
    }
    private getDistTime = (
        distX: number,
        rect: ClientRect = this.scrollArea.keyframesArea.scrollAreaElement.getBoundingClientRect()
    ) => {
        const scrollAreaWidth = rect.width - 30;
        const percentage = Math.min(scrollAreaWidth, distX) / scrollAreaWidth;
        const time = this.state.maxTime * percentage;

        return Math.round(time * 20) / 20;
    };
    private getTime = (clientX: number) => {
        const rect = this.scrollArea.keyframesArea.scrollAreaElement.getBoundingClientRect();
        const scrollAreaX = rect.left + 15;
        const x = Math.max(clientX - scrollAreaX, 0);

        return this.getDistTime(x, rect);
    };
    private moveCursor(time: number) {
        const maxTime = this.state.maxTime;
        const px = 15 - (30 * time) / maxTime;
        const percent = (100 * time) / maxTime;
        const left = `calc(${percent}% + ${px}px)`;

        this.scrollArea.keyframesArea.cursor.getElement().style.left = left;
        this.headerArea.keytimesArea.cursor.getElement().style.left = left;
    }
    private setInputs(obj: IObject<any>) {
        this.values = obj;
        const valuesArea = this.scrollArea.valuesArea.getElement();
        for (const name in obj) {
            valuesArea.querySelector<HTMLInputElement>(
                `[data-id="${name}"] input`
            )!.value = obj[name];
        }
    }

    private removeKeyframe(property: string) {
        const propertiesInfo = this.state.timelineInfo[property];
        if (!property || !propertiesInfo || isScene(propertiesInfo.item)) {
            return;
        }

        const properties = propertiesInfo.properties;
        const item = propertiesInfo.item!;

        item.remove(item.getIterationTime(), ...properties);
        this.update();
    }
    private addKeyframe(index: number, time: number) {
        const keyframesList = this.scrollArea.keyframesArea.keyframesList!;
        const id = keyframesList[index].props.id;

        // --- check if we need to change the duration of the animation
        if (this.props.scene) {
            const timelineInfo = getTimelineInfo(this.props.scene);
            const propertiesInfo = timelineInfo[id];
            const selectedItem = propertiesInfo.item;

            const itemTotalDuration = selectedItem.getTotalDuration();

            if (time > itemTotalDuration) {
                // @ts-ignore
                selectedItem.newFrame(time);
                this.setTime(time);
            }
        }

        this.select(id, time);

        this.editKeyframe(index, "");

        // const inputElement = this.scrollArea.valuesArea.values[index]
        //     .inputElement!;

        // if (inputElement) {
        //     this.editKeyframe(index, inputElement.value);
        // }
    }
    private animate = (e: any) => {
        const time = e.time;
        const minute = numberFormat(Math.floor(time / 60), 2);
        const second = numberFormat(Math.floor(time % 60), 2);
        const milisecond = numberFormat(Math.floor((time % 1) * 100), 3, true);

        this.moveCursor(time);
        this.setInputs(flatObject(e.frames || e.frame.get()));
        this.controlArea.timeArea.getElement().value = `${minute}:${second}:${milisecond}`;
    };
    private initScene(scene?: Scene | SceneItem, isInit?: boolean) {
        if (!scene) {
            return {
                timelineInfo: {},
                maxTime: 0,
                maxDuration: 0,
                zoom: 1,
                init: false,
            };
        }
        scene.finish();
        scene.on("animate", this.animate);
        const duration = Math.ceil(scene.getDuration());

        return {
            timelineInfo: getTimelineInfo(scene),
            maxTime: duration,
            maxDuration: duration,
            zoom: 1,
            init: isInit || false,
        };
    }
    private releaseScene(scene?: Scene | SceneItem) {
        if (!scene) {
            return;
        }
        scene.off("animate", this.animate);
    }
    private initWheelZoom() {
        const keyframesArea = this.scrollArea.keyframesArea.getElement();

        this.pinchDragger = new Dragger(keyframesArea, {
            pinchstart: ({ datas }) => {
                datas.zoom = this.state.zoom;
            },
            pinch: ({ scale, datas }) => {
                console.log("SCALE", scale);
                this.setZoom(datas.zoom * scale);
            },
        });
    }
    private initScroll() {
        let isScrollKeyframe = false;

        const headerKeyframesArea = this.headerArea.keytimesArea.getElement();
        const scrollKeyframesArea = this.scrollArea.keyframesArea.getElement();

        headerKeyframesArea.addEventListener("scroll", () => {
            if (isScrollKeyframe) {
                isScrollKeyframe = false;
            } else {
                isScrollKeyframe = true;
                scrollKeyframesArea.scrollLeft = headerKeyframesArea.scrollLeft;
            }
        });
        scrollKeyframesArea.addEventListener("scroll", (e) => {
            if (isScrollKeyframe) {
                isScrollKeyframe = false;
            } else {
                isScrollKeyframe = true;
                headerKeyframesArea.scrollLeft = scrollKeyframesArea.scrollLeft;
            }
        });
    }
    private selectByKeyframe(keyframeElement: HTMLElement) {
        const keyframesElement: HTMLElement = keyframeElement.parentElement!
            .parentElement!;
        const time = parseFloat(
            keyframeElement.getAttribute("data-time") || "0"
        );
        const id = keyframesElement.getAttribute("data-id") || "";

        this.setTime(time);
        this.select(id, time);
    }
    private initDragKeyframes() {
        const click = (e: MouseEvent, clientX: number, clientY: number) => {
            const time = this.getTime(clientX);
            const list = this.scrollArea.keyframesArea.keyframesList;
            const index = findElementIndexByPosition(
                list.map((keyframes) => keyframes.getElement()),
                clientY
            );

            this.setTime(time);
            index > -1 && this.select(list[index].props.id, time);
            e.preventDefault();
        };
        const dblclick = (e: MouseEvent, clientX: number, clientY: number) => {
            const list = this.scrollArea.keyframesArea.keyframesList;
            const index = findElementIndexByPosition(
                list.map((keyframes) => keyframes.getElement()),
                clientY
            );

            if (index === -1) {
                return;
            }

            this.addKeyframe(index, this.getTime(clientX));
        };
        const keytimesScrollArea = this.headerArea.keytimesArea
            .scrollAreaElement;
        const keyframesScrollArea = this.scrollArea.keyframesArea
            .scrollAreaElement;
        let dragItem: Scene | SceneItem | null;
        let dragDelay: number = 0;
        let dragTarget: HTMLElement | null;
        this.draggers = [keytimesScrollArea, keyframesScrollArea].map(
            (element) => {
                const baseFrameTimes: number[] = [];

                return new Dragger(element, {
                    container: window,
                    dragstart: ({ clientX, inputEvent }) => {
                        const inputTarget = inputEvent.target;
                        const keyframeTarget = getTarget(inputTarget, (el) =>
                            hasClass(el, "keyframe")
                        );

                        if (keyframeTarget) {
                            this.selectByKeyframe(keyframeTarget);
                            return false;
                        }
                        dragTarget = getTarget(inputTarget, (el) =>
                            hasClass(el, "keyframe-group")
                        );
                        if (dragTarget) {
                            const properties = this.scrollArea.propertiesArea
                                .properties;
                            const keyframesElement = getTarget(
                                dragTarget,
                                (el) => hasClass(el, "keyframes")
                            )!;
                            const id = keyframesElement.getAttribute(
                                "data-id"
                            )!;
                            const property = find(
                                properties,
                                (p) => p.props.id === id
                            )!;
                            const propertiesInfo =
                                property.props.propertiesInfo;

                            dragItem = propertiesInfo.item;

                            // @ts-ignore
                            const editorDelay = dragItem.editorDelay;
                            dragDelay = editorDelay ? editorDelay : 0.0;

                            let index = 0;

                            for (const time in dragItem.items) {
                                baseFrameTimes[index] = parseFloat(time);
                                index++;
                            }
                        }
                    },
                    drag: ({ distX, deltaX, deltaY, inputEvent }) => {
                        if (dragTarget && dragItem) {
                            const nextDelay =
                                dragDelay + this.getDistTime(distX);

                            // @ts-ignore
                            if (dragItem.editorDelay !== nextDelay) {
                                // @ts-ignore
                                dragItem.editorDelay = nextDelay;
                                const items: any = dragItem.items;
                                let index = 0;

                                for (const time in items) {
                                    const newTime =
                                        baseFrameTimes[index] + nextDelay;

                                    // @ts-ignore
                                    dragItem.removeFrame(time);
                                    // @ts-ignore
                                    dragItem.newFrame(newTime);

                                    index++;
                                }

                                // @ts-ignore
                                dragItem.update();

                                this.update(false, false);
                            }
                        } else {
                            this.scrollArea.keyframesArea.getElement().scrollLeft -= deltaX;
                            this.scrollArea.getElement().scrollTop -= deltaY;
                            inputEvent.preventDefault();
                        }
                    },
                    dragend: ({ isDrag, clientX, clientY, inputEvent }) => {
                        dragTarget = null;
                        dragItem = null;
                        dragDelay = 0;
                        !isDrag && click(inputEvent, clientX, clientY);
                        dblCheck(
                            isDrag,
                            inputEvent,
                            clientX,
                            clientY,
                            dblclick
                        );
                    },
                });
            }
        );
    }
    private onBlur = () => {
        if (this.state.alt === true) {
            this.setState({ alt: false });
        }
    };
    private initKeyController() {
        addEvent(window, "blur", this.onBlur);

        const keycon = KeyController.global;
        const keyMap = this.keyMap;
        const keydownMap = keyMap.keydown;
        const keyupMap = keyMap.keyup;

        keycon.keydown("alt", keydownMap.alt).keyup("alt", keyupMap.alt);

        if (this.props.keyboard) {
            keycon
                .keydown("space", keydownMap.space)
                .keydown("left", keydownMap.left)
                .keydown("right", keydownMap.right)
                .keyup("backspace", keyupMap.backspace)
                .keyup("esc", keyupMap.esc)
                .keyup("space", keyupMap.space);
        }
    }
}
