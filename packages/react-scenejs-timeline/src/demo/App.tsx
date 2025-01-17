import { Component } from "react";
import * as React from "react";
import Timeline from "../react-scenejs-timeline";
import Scene from "scenejs";
import { poly } from "shape-svg";
import "./App.css";
import { ref } from "framework-utils";

export default class App extends Component<{}> {
    private scene: Scene = new Scene();
    private timeline!: Timeline;
    public render() {
        return (
            <div>
                <div id="main" className="page page1">
                    <div className="container">
                        <div className="logo">
                            <div className="dash-line"></div>
                            <div className="dash-line"></div>
                            <div className="dash-line"></div>
                            <div className="dash-line"></div>
                            <div className="clapper">
                                <div className="background">
                                    <div className="stick stick1">
                                        <div className="rect rect1"></div>
                                        <div className="rect rect2"></div>
                                        <div className="rect rect3"></div>
                                        <div className="rect rect4"></div>
                                        <div className="rect rect5"></div>
                                        <div className="rect rect6"></div>
                                    </div>
                                    <div className="stick stick1 shadow"></div>
                                    <div className="stick stick2">
                                        <div className="rect rect1"></div>
                                        <div className="rect rect2"></div>
                                        <div className="rect rect3"></div>
                                        <div className="rect rect4"></div>
                                        <div className="rect rect5"></div>
                                        <div className="rect rect6"></div>
                                    </div>
                                    <div className="stick stick2 shadow"></div>
                                    <div className="bottom"></div>
                                    <div className="bottom shadow"></div>
                                </div>
                                <div className="play-circle"></div>
                                <div className="play-btn"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <Timeline
                    ref={ref(this, "timeline")}
                    scene={this.scene}
                    style={{
                        maxHeight: "350px",
                        position: "fixed",
                        bottom: 0,
                        left: 0,
                        right: 0,
                    }}
                    onSelect={(item) => {
                        //console.log("onSelect", item);
                    }}
                    onUpdate={() => {
                        console.log("onUpdate");
                    }}
                    onTrackAdded={(item) => {
                        console.log("onTrackAdded", item);
                    }}
                    onTrackRemoved={(item) => {
                        console.log("onTrackRemoved", item);
                    }}
                    onTogglePlay={(playState) => {
                        console.log("onTogglePlay", playState);
                    }}
                    onToggleRecord={(recordingState) => {
                        console.log("onToggleRecord", recordingState);
                    }}
                    onTimeUpdated={(time) => {
                        //console.log("onTimeUpdated", time);
                    }}
                />
            </div>
        );
    }
    public componentDidMount() {
        (window as any).app = this;

        const playBtn = poly({
            width: 60,
            strokeWidth: 8,
            strokeLinejoin: "round",
            rotate: 90,
            origin: "50% 50%",
            left: 10,
            top: 15,
            fill: "#333",
            stroke: "#333",
        });

        // shadow
        poly(
            {
                width: 60,
                strokeWidth: 8,
                strokeLinejoin: "round",
                rotate: 90,
                origin: "50% 50%",
                left: 20,
                top: 30,
                opacity: 0.2,
                fill: "#333",
                stroke: "#333",
            },
            playBtn
        );

        document.querySelector(".play-btn")!.appendChild(playBtn);

        this.scene.load(
            {
                clapper: {
                    2: "",
                    2.55: "",
                    3: "",
                    3.5: "",
                },
                // ".play-btn": {
                //     0: {
                //         transform: "translate(-50%, -50%) scale(0)",
                //     },
                //     1: {
                //         transform: "scale(1)",
                //     },
                //     options: {
                //         delay: 0.6,
                //     },
                // },
                // ".play-circle": {
                //     0: {
                //         transform: "translate(-50%, -50%) scale(0)",
                //     },
                //     1: {
                //         transform: "scale(1)",
                //     },
                //     options: {
                //         delay: 0.3,
                //     },
                // },
                // ".background": {
                //     0: {
                //         transform: "translate(-50%, -50%) scale(0)",
                //     },
                //     1: {
                //         transform: "scale(1)",
                //     },
                // },
                // ".stick1 .rect": i => ({
                //     0: {
                //         transform: {
                //             scale: 0,
                //             skew: "15deg",
                //         },
                //     },
                //     0.7: {
                //         transform: {
                //             scale: 1,
                //         },
                //     },
                //     options: {
                //         delay: 1 + i % 6 * 0.1,
                //     },
                // }),
                // ".stick2 .rect": i => ({
                //     0: {
                //         transform: {
                //             scale: 0,
                //             skew: "-15deg",
                //         },
                //     },
                //     0.7: {
                //         transform: {
                //             scale: 1,
                //         },
                //     },
                //     options: {
                //         delay: 1.2 + i % 6 * 0.1,
                //     },
                // }),
                // ".stick1": {
                //     0: {
                //         transform: {
                //             rotate: "0deg",
                //         },
                //     },
                //     0.5: {
                //         transform: {
                //             rotate: "-20deg",
                //         },
                //     },
                //     1: {
                //         transform: {
                //             rotate: "0deg",
                //         },
                //     },
                //     1.5: {
                //         transform: {
                //             rotate: "-10deg",
                //         },
                //     },
                //     options: {
                //         delay: 2.2,
                //     },
                // },
                // ".logo": {
                //     0: {
                //         transform: "scale(1.2) translate(-50%, -50%) rotate(0deg)",
                //     },
                //     0.5: {
                //         transform: "rotate(-15deg)",
                //     },
                //     1: {
                //         transform: "rotate(0deg)",
                //     },
                //     1.5: {
                //         transform: "rotate(-10deg)",
                //     },
                //     options: {
                //         delay: 2.2,
                //     },
                // },
                // ".clapper": {
                //     1.5: {
                //         transform: "translate(-50%, -50%) translateY(30px) scale(1)",
                //     },
                //     2.5: {
                //         transform: "scale(0.7)",
                //     },
                //     options: {
                //         delay: 2.2,
                //     },
                // },
                // ".dash-line": i => ({
                //     0: {
                //         transform: `rotate(${i * 90}deg) translate2(0px, -100%)`,
                //     },
                //     1: {
                //         transform: "translate2(0px, 0%)",
                //     },
                //     options: {
                //         delay: 3.6 + (i % 2 + i * 0.5) * 0.1,
                //     },
                // }),
            },
            {
                easing: "ease-in-out",
                iterationCount: 1,
                selector: true,
            }
        );
        this.timeline.update(true);
    }
}
