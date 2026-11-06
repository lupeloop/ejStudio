// ════════════════════════════════════════════════════════════════════════════
//  Background FX (landing + processing). One real 60 s log window drives ten
//  scenes, each a preview of a real view: Graph, Tables, Edit, Suggestions,
//  MAF Tools, MAF Curve, Scatter, Compare, Pull splitter, Diagnostics. Each
//  scene has its own camera moves, and each transition is built from a feature.
//  Table = loaded tune's base timing (else a baked copy); MAF bins are real
//  pooled results from your logs; MAF scale from the tune (else baked).
// ════════════════════════════════════════════════════════════════════════════
const BG_PATH={"r":[2208,2197,2193,2196,2137,2269,3026,3032,3080,3296,3358,3420,3496,3577,3620,3646,3678,3741,3762,3753,3784,3770,3667,3551,2662,2592,2566,2588,2600,2614,2589,2541,2477,2452,2572,2635,2665,2700,2696,2719,2708,2694,2650,2586,2536,2494,2494,2520,2513,2516,2542,2542,2536,2562,2548,2574,2564,2585,2578,2599,2606,2593,2616,2628,2617,2623,2641,2656,2661,2648,2653,2672,2677,2678,2683,2687,2708,2697,2717,2720,2729,2717,2722,2731,2731,2755,2745,2748,2776,2778,2768,2766,2766,2794,2778,2804,2795,2794,2794,2808,2810,2819,2828,2836,2832,2830,2837,2832,2842,2846,2843,2850,2836,2828,2839,2820,2816,2812,2803,2790,2787,2755,2757,2752,2734,2730,2729,2737,2736,2716,2712,2711,2728,2728,2726,2727,2704,2701,2702,2700,2710,2706,2699,2693,2688,2683,2676,2665,2653,2640,2618,2625,2593,2598,2584,2555,2558,2543,2518,2519,2508,2488,2466,2474,2468,2480,2476,2477,2480,2482,2472,2482,2486,2512,2512,2513,2516,2544,2538,2563,2564,2588,2580,2599,2582,2580,2592,2569,2579,2564,2578,2568,2580,2568,2585,2572,2578,2597,2580,2596,2578,2580,2593,2576,2594,2566,2578,2562,2577,2557,2568,2552,2565,2540,2552,2546,2541,2552,2546,2570,2563,2588,2579,2603,2614,2608,2616,2637,2644,2637,2644,2654,2654,2667,2680,2678,2680,2681,2680,2683],"l":[0.25,0.2,0.14,0.14,0.26,0.32,0.19,0.16,0.64,0.94,1.08,1.26,1.43,1.56,1.6,1.57,1.56,1.54,1.48,1.32,1.23,1.08,0.54,0.51,0.44,0.39,0.38,0.54,0.61,0.6,0.35,0.27,0.18,0.3,0.69,0.75,0.79,0.85,0.86,0.84,0.75,0.73,0.78,0.79,0.82,0.87,0.9,0.9,0.91,0.91,0.89,0.88,0.92,0.92,0.93,0.93,0.92,0.92,0.94,0.92,0.94,0.92,0.92,0.92,0.92,0.92,0.91,0.91,0.92,0.93,0.91,0.93,0.95,0.94,0.95,0.95,0.96,0.95,0.94,0.93,0.94,0.93,0.93,0.92,0.92,0.92,0.88,0.91,0.91,0.91,0.91,0.91,0.9,0.88,0.9,0.9,0.88,0.88,0.89,0.85,0.82,0.83,0.85,0.86,0.85,0.82,0.82,0.8,0.81,0.82,0.77,0.7,0.47,0.35,0.28,0.21,0.17,0.14,0.15,0.15,0.16,0.22,0.41,0.44,0.51,0.56,0.56,0.55,0.55,0.54,0.53,0.54,0.54,0.55,0.55,0.55,0.42,0.36,0.35,0.34,0.36,0.37,0.36,0.36,0.37,0.31,0.25,0.19,0.16,0.15,0.15,0.16,0.16,0.15,0.16,0.16,0.15,0.15,0.15,0.16,0.15,0.16,0.19,0.22,0.29,0.38,0.48,0.65,0.76,0.8,0.82,0.83,0.9,0.98,0.98,0.97,0.98,0.98,0.99,0.98,0.95,0.95,0.89,0.72,0.5,0.3,0.26,0.3,0.32,0.32,0.35,0.83,0.86,0.86,0.84,0.87,0.58,0.44,0.49,0.55,0.48,0.45,0.39,0.4,0.45,0.42,0.41,0.44,0.38,0.33,0.3,0.3,0.33,0.33,0.34,0.48,0.8,0.83,0.92,0.96,0.99,0.98,1.01,1.01,1,1.01,1.01,1,0.96,0.96,0.96,0.83,0.72,0.59,0.6,0.64,0.68,0.69,0.7,0.69],"w":[0.884,0.898,0.857,0.952,0.857,0.837,1.054,0.905,1.068,0.939,0.891,0.939,0.912,0.905,0.85,0.85,0.85,0.857,0.85,0.864,0.85,1.02,0.857,1.238,1.163,1.19,1.238,1.163,0.844,0.946,0.959,0.871,0.98,1.034,1.231,0.993,0.986,1.163,1.143,0.946,0.823,0.837,1.027,1.102,1.088,0.857,0.918,0.837,0.837,0.878,1.061,1.17,0.871,0.932,0.837,0.83,1.143,1.02,1.027,1.068,0.857,0.918,0.878,1.17,1.143,0.864,0.952,0.837,0.83,0.952,1.116,0.857,0.891,1.054,0.837,0.878,0.925,0.864,1.143,1.102,0.939,0.864,0.857,1.163,1.095,0.932,1,0.85,0.837,1.041,1.007,0.871,0.85,1.17,1.17,0.966,1,1.136,0.844,0.918,0.85,1.197,0.878,0.959,0.844,0.844,0.844,0.959,0.884,0.85,0.864,0.905,0.83,0.993,1.102,1.088,1.231,1.088,1.3,1.3,1.3,1.3,1.095,1.034,0.912,0.857,0.837,0.844,0.83,0.85,0.844,0.844,0.85,0.85,0.85,0.837,0.844,0.823,0.844,0.85,0.878,0.871,0.844,0.864,0.864,0.844,0.816,0.81,0.803,0.803,0.891,1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.17,1.041,0.952,0.986,0.816,0.816,0.85,0.857,0.857,0.864,0.844,0.844,0.864,0.857,0.864,0.864,0.85,0.85,0.864,0.837,0.81,0.796,0.83,0.837,1.082,0.884,0.912,0.871,0.816,0.844,0.857,0.864,0.864,0.796,0.816,0.837,1.007,0.857,0.864,0.891,0.864,0.871,0.85,0.844,0.864,0.85,0.85,0.925,0.81,0.837,0.85,0.871,0.857,0.816,0.878,0.844,0.884,0.878,0.857,0.857,0.878,0.857,0.864,0.884,0.864,0.912,0.864,0.864,0.912,0.857,0.871,0.918,0.837,0.871,0.857,0.844],"v":[1.64,1.52,1.4,1.38,1.5,1.88,1.64,1.56,2.12,2.64,2.78,2.92,3.06,3.1,3.16,3.16,3.14,3.14,3.12,3.06,2.98,2.9,2.32,2.24,2,1.92,1.9,2.08,2.16,2.16,1.86,1.76,1.52,1.72,2.2,2.3,2.34,2.4,2.44,2.42,2.34,2.3,2.32,2.34,2.34,2.38,2.4,2.4,2.44,2.44,2.4,2.4,2.42,2.44,2.44,2.44,2.46,2.46,2.46,2.46,2.46,2.46,2.44,2.46,2.46,2.46,2.46,2.48,2.46,2.48,2.46,2.48,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.48,2.48,2.46,2.5,2.48,2.48,2.5,2.48,2.5,2.48,2.5,2.48,2.5,2.48,2.48,2.46,2.42,2.42,2.46,2.46,2.46,2.42,2.44,2.44,2.42,2.42,2.4,2.34,2.12,1.9,1.8,1.68,1.56,1.48,1.48,1.48,1.5,1.64,1.96,2.02,2.08,2.14,2.14,2.14,2.14,2.14,2.12,2.12,2.12,2.14,2.14,2.14,2,1.9,1.88,1.88,1.9,1.92,1.88,1.9,1.92,1.82,1.72,1.58,1.5,1.48,1.48,1.48,1.48,1.48,1.48,1.48,1.48,1.46,1.46,1.46,1.46,1.46,1.54,1.6,1.72,1.88,1.98,2.16,2.26,2.3,2.34,2.36,2.4,2.46,2.46,2.48,2.48,2.48,2.5,2.5,2.48,2.46,2.42,2.26,2.08,1.8,1.72,1.78,1.82,1.82,1.86,2.34,2.4,2.4,2.38,2.4,2.16,1.98,2.02,2.1,2.06,1.98,1.92,1.94,2,1.96,1.94,1.98,1.9,1.82,1.78,1.78,1.82,1.84,1.84,1.98,2.32,2.38,2.42,2.46,2.5,2.5,2.52,2.52,2.54,2.52,2.52,2.52,2.48,2.5,2.5,2.4,2.3,2.18,2.18,2.22,2.24,2.24,2.24,2.24],"bins":[{"v":0.9,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":1.92,"gn":1.92,"solid":false},{"v":0.94,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":2.04,"gn":2.04,"solid":false},{"v":0.98,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":2.18,"gn":2.18,"solid":false},{"v":1.02,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":2.34,"gn":2.34,"solid":false},{"v":1.05,"n":45,"src":"CL","f":0.9641,"cl":0.96,"ol":null,"afl":-5.42,"afc":1.78,"wb":null,"ff":null,"d":-3.59,"g":2.47,"gn":2.38,"solid":false},{"v":1.09,"n":147,"src":"CL","f":0.9623,"cl":0.962,"ol":null,"afl":-5.42,"afc":1.84,"wb":null,"ff":null,"d":-3.77,"g":2.68,"gn":2.58,"solid":true},{"v":1.13,"n":344,"src":"CL","f":1.0043,"cl":1.004,"ol":null,"afl":-3.2,"afc":4.27,"wb":null,"ff":null,"d":0.43,"g":2.96,"gn":2.97,"solid":true},{"v":1.17,"n":901,"src":"CL","f":1.0032,"cl":1.003,"ol":null,"afl":-3,"afc":3.97,"wb":null,"ff":null,"d":0.32,"g":3.32,"gn":3.33,"solid":true},{"v":1.21,"n":781,"src":"CL","f":1.0056,"cl":1.006,"ol":null,"afl":-3,"afc":4.01,"wb":null,"ff":null,"d":0.56,"g":3.72,"gn":3.74,"solid":true},{"v":1.25,"n":318,"src":"CL","f":1.0183,"cl":1.018,"ol":null,"afl":-3.3,"afc":5.19,"wb":null,"ff":null,"d":1.83,"g":4.06,"gn":4.13,"solid":true},{"v":1.29,"n":109,"src":"CL","f":1.0048,"cl":1.005,"ol":null,"afl":-6.49,"afc":6.4,"wb":null,"ff":null,"d":0.48,"g":4.35,"gn":4.37,"solid":true},{"v":1.33,"n":61,"src":"CL","f":1.0097,"cl":1.01,"ol":null,"afl":-3.8,"afc":5.18,"wb":null,"ff":null,"d":0.97,"g":4.63,"gn":4.67,"solid":true},{"v":1.37,"n":45,"src":"CL","f":1.0106,"cl":1.012,"ol":null,"afl":-3.8,"afc":5.91,"wb":null,"ff":null,"d":1.06,"g":5.02,"gn":5.07,"solid":false},{"v":1.41,"n":81,"src":"CL","f":1.0191,"cl":1.019,"ol":null,"afl":-3.5,"afc":6.53,"wb":null,"ff":null,"d":1.91,"g":5.55,"gn":5.66,"solid":true},{"v":1.48,"n":210,"src":"CL","f":1.0116,"cl":1.012,"ol":null,"afl":-4.88,"afc":5.6,"wb":null,"ff":null,"d":1.16,"g":6.67,"gn":6.75,"solid":true},{"v":1.56,"n":320,"src":"MIX","f":1.0084,"cl":1.008,"ol":1.175,"afl":-5.47,"afc":6.59,"wb":1.17,"ff":0.9,"d":0.84,"g":8.11,"gn":8.18,"solid":true},{"v":1.64,"n":397,"src":"MIX","f":0.9879,"cl":0.988,"ol":1.139,"afl":-8,"afc":6.52,"wb":1.136,"ff":0.9,"d":-1.21,"g":9.66,"gn":9.54,"solid":true},{"v":1.72,"n":494,"src":"MIX","f":0.9882,"cl":0.988,"ol":1.139,"afl":-8.6,"afc":7.37,"wb":1.082,"ff":0.9,"d":-1.18,"g":11.34,"gn":11.21,"solid":true},{"v":1.8,"n":515,"src":"MIX","f":0.9858,"cl":0.986,"ol":1.337,"afl":-8.6,"afc":7.14,"wb":1.293,"ff":0.9,"d":-1.42,"g":13.23,"gn":13.04,"solid":true},{"v":1.88,"n":664,"src":"MIX","f":0.9692,"cl":0.969,"ol":1.337,"afl":-8.6,"afc":5.5,"wb":1.293,"ff":0.9,"d":-3.08,"g":15.47,"gn":14.99,"solid":true},{"v":1.95,"n":755,"src":"MIX","f":0.9601,"cl":0.96,"ol":1.35,"afl":-8.8,"afc":5.09,"wb":1.327,"ff":0.9,"d":-3.99,"g":17.73,"gn":17.02,"solid":true},{"v":2.03,"n":718,"src":"MIX","f":0.9625,"cl":0.963,"ol":1.35,"afl":-8.9,"afc":5.37,"wb":1.327,"ff":0.9,"d":-3.75,"g":20.58,"gn":19.81,"solid":true},{"v":2.11,"n":721,"src":"CL","f":0.9563,"cl":0.956,"ol":null,"afl":-9.5,"afc":5.31,"wb":null,"ff":null,"d":-4.37,"g":23.72,"gn":22.68,"solid":true},{"v":2.19,"n":478,"src":"CL","f":0.9444,"cl":0.944,"ol":null,"afl":-10.4,"afc":4.27,"wb":null,"ff":null,"d":-5.56,"g":27.1,"gn":25.59,"solid":true},{"v":2.23,"n":636,"src":"CL","f":0.9381,"cl":0.938,"ol":null,"afl":-9.8,"afc":3.35,"wb":null,"ff":null,"d":-6.19,"g":29.98,"gn":28.12,"solid":true},{"v":2.34,"n":1185,"src":"CL","f":0.9576,"cl":0.958,"ol":null,"afl":-8.8,"afc":4.2,"wb":null,"ff":null,"d":-4.24,"g":34.05,"gn":32.61,"solid":true},{"v":2.42,"n":1270,"src":"CL","f":0.971,"cl":0.971,"ol":null,"afl":-7.8,"afc":4.48,"wb":null,"ff":null,"d":-2.9,"g":38.17,"gn":37.06,"solid":true},{"v":2.54,"n":685,"src":"MIX","f":0.9814,"cl":0.981,"ol":0.929,"afl":-6.7,"afc":4.65,"wb":0.952,"ff":0.958,"d":-1.86,"g":44.55,"gn":43.72,"solid":true},{"v":2.66,"n":201,"src":"MIX","f":0.9992,"cl":0.999,"ol":1.024,"afl":-6.2,"afc":4.1,"wb":1.068,"ff":0.961,"d":-0.08,"g":51.84,"gn":51.8,"solid":true},{"v":2.77,"n":55,"src":"MIX","f":0.9902,"cl":0.995,"ol":0.969,"afl":-7.3,"afc":6.11,"wb":1,"ff":0.963,"d":-0.98,"g":59.01,"gn":58.43,"solid":true},{"v":2.89,"n":39,"src":"MIX","f":0.9697,"cl":0.92,"ol":0.961,"afl":-7.3,"afc":0.12,"wb":0.973,"ff":0.944,"d":-3.03,"g":68.26,"gn":66.19,"solid":false},{"v":3.01,"n":18,"src":"OL","f":0.9743,"cl":null,"ol":0.928,"afl":-6.6,"afc":null,"wb":0.898,"ff":0.901,"d":-2.57,"g":78.7,"gn":76.68,"solid":false},{"v":3.12,"n":6,"src":"OL","f":0.9947,"cl":null,"ol":0.954,"afl":-6.2,"afc":null,"wb":0.85,"ff":0.843,"d":-0.53,"g":93.79,"gn":93.29,"solid":false},{"v":3.24,"n":1,"src":"OL","f":0.9992,"cl":null,"ol":0.959,"afl":-6.2,"afc":null,"wb":0.85,"ff":0.831,"d":-0.08,"g":107.22,"gn":107.13,"solid":false},{"v":3.36,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":122.48,"gn":122.48,"solid":false},{"v":3.48,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":137.74,"gn":137.74,"solid":false},{"v":3.59,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":153.01,"gn":153.01,"solid":false},{"v":3.71,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":168.26,"gn":168.26,"solid":false},{"v":3.83,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":183.53,"gn":183.53,"solid":false},{"v":3.95,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":198.79,"gn":198.79,"solid":false},{"v":4.06,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":214.06,"gn":214.06,"solid":false},{"v":4.18,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":229.32,"gn":229.32,"solid":false},{"v":4.3,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":244.58,"gn":244.58,"solid":false},{"v":4.41,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":259.84,"gn":259.84,"solid":false},{"v":4.49,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":275.1,"gn":275.1,"solid":false},{"v":4.57,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":290.37,"gn":290.37,"solid":false},{"v":4.61,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":305.63,"gn":305.63,"solid":false},{"v":4.65,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":320.9,"gn":320.9,"solid":false},{"v":4.69,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":336.16,"gn":336.16,"solid":false},{"v":4.73,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":351.42,"gn":351.42,"solid":false},{"v":4.8,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":366.68,"gn":366.68,"solid":false},{"v":4.88,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":381.94,"gn":381.94,"solid":false},{"v":4.96,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":397.21,"gn":397.21,"solid":false},{"v":5,"n":0,"src":null,"f":1,"cl":null,"ol":null,"afl":null,"afc":null,"wb":null,"ff":null,"d":0,"g":412.47,"gn":412.47,"solid":false}]};
const BG_TBL={x:[0.15,0.20,0.28,0.38,0.48,0.58,0.78,0.94,1.10,1.22,1.34,1.50,1.66,1.78,1.90,2.00,2.10,2.18],
  y:[800,1200,1600,2000,2400,2800,3200,3600,4000,4400,4800,5200,5600,6000,6400,6800,7200,7600],
  z:`16.9,19.4,22.5,26.4,22.9,16.9,4.6,-3.1,-4.9,-5.9,-7.0,-8.0,-8.0,-8.0,-8.0,-8.0,-8.0,-8.0
28.9,41.9,40.1,37.7,34.5,28.9,8.8,2.9,-3.1,-4.5,-5.9,-7.0,-7.0,-7.0,-7.0,-7.0,-7.0,-7.0
33.4,47.1,47.1,40.5,34.8,28.9,13.8,8.1,3.6,1.4,0.0,-2.1,-3.5,-4.5,-5.6,-6.6,-6.6,-6.6
35.5,47.1,47.1,39.1,32.7,28.9,18.0,10.9,6.0,4.6,2.5,1.1,-0.7,-1.4,-2.4,-3.1,-3.5,-3.8
35.5,47.1,47.1,38.7,33.8,29.6,19.7,14.5,8.8,6.4,3.9,2.1,0.4,-0.7,-1.4,-2.1,-2.4,-3.1
35.5,47.1,47.1,40.5,35.5,31.0,20.4,15.9,8.8,7.4,6.0,3.9,2.5,1.4,0.4,-0.7,-1.4,-2.1
35.5,47.1,47.1,44.0,39.4,35.9,25.0,17.6,12.0,10.9,8.5,5.7,3.6,2.5,1.4,1.1,0.4,0.0
35.5,47.1,47.1,45.0,41.5,38.0,28.9,20.1,15.9,14.1,12.0,8.8,7.1,6.0,5.0,3.9,2.9,2.5
35.5,47.1,47.1,45.0,41.5,38.0,29.9,21.1,18.0,15.9,14.5,11.6,9.5,8.5,7.4,7.1,6.4,6.0`.split('\n').map(r=>r.split(',').map(Number))};
while(BG_TBL.z.length<18) BG_TBL.z.push(BG_TBL.z[BG_TBL.z.length-1].slice());
let BGFX_PULLS=null;
const BGFX=(()=>{
  const cv=$('bgfx'), P=BG_PATH, N=P.r.length, FR=255/2, RED='#ff1e1e', MONO="ui-monospace,'SF Mono',Menlo,Consolas,monospace";
  const fiA=(a,v)=>{ if(v<=a[0]) return 0; if(v>=a[a.length-1]) return a.length-1; for(let i=0;i<a.length-1;i++) if(v<a[i+1]) return i+(v-a[i])/(a[i+1]-a[i]); return a.length-1; };
  const at=(arr,f)=>{ const i=((Math.floor(f)%N)+N)%N, j=(i+1)%N, a=f-Math.floor(f); return arr[i]+(arr[j]-arr[i])*a; };
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2, cl=(x,a,b)=>Math.max(a,Math.min(b,x)), seg=(t,a,b)=>cl((t-a)/(b-a),0,1), lerp=(a,b,t)=>a+(b-a)*t;
  const SQ=[['graph',9000],['tables',9500],['edit',9000],['sug',9500],['maf',8500],['curve',7500],['scatter',7500],['compare',7000],['pulls',7500],['diag',7500]], WIPE=2000;
  const PH=[]; SQ.forEach(([k,d],i)=>{ PH.push([k,d]); PH.push(['w'+i,WIPE]); }); const CYCLE=PH.reduce((s,p)=>s+p[1],0);
  const BINS=P.bins, ROWS=BINS.map((b,i)=>({...b,i})).filter(b=>b.n>0);
  let raf=0, t0=0, on=false, px=null, py=null, liveRow=-1, liveT=0, lastTs=0, fAcc=24000/255, mvE=null;
  const tbl=()=>{ const t=TUNE&&TUNE.byId&&TUNE.byId.spark_base; return t?{x:t.x,y:t.y,z:t.z}:BG_TBL; };
  const scale=()=>{ const s=TUNE&&TUNE.mafScale; return s&&s.length===BINS.length?s:BINS.map(b=>b.g); };
  function frame(ts){
    raf=0; if(!on) return; if(!t0) t0=ts;
    const dpr=Math.min(1.5,devicePixelRatio||1), W=innerWidth, H=innerHeight;
    if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
    const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H);
    const el=ts-t0, dt=lastTs?Math.min(100,ts-lastTs):16; lastTs=ts; let ct=el%CYCLE, ph='graph', pt=0; for(const [k,d] of PH){ if(ct<d){ ph=k; pt=ct/d; break; } ct-=d; }
    // graph + table play at 2×; MAF curve / table at real time (1×) like a live log
    const RATE={graph:2,tables:2,compare:1.5}; fAcc+=dt/255*(RATE[ph]||1); const f=fAcc;
    const rpm=at(P.r,f), load=at(P.l,f), mvRaw=at(P.v,f), m=8, PX=W*0.64; if(mvE==null) mvE=mvRaw; mvE+=(mvRaw-mvE)*Math.min(1,dt/220); const mafv=mvE;   // eased like the real crosshair
    // ── Tables geometry ──
    const T=tbl(), nx=T.x.length, ny=T.y.length; let zlo=Infinity,zhi=-Infinity; T.z.forEach(r=>r.forEach(v=>{ zlo=Math.min(zlo,v); zhi=Math.max(zhi,v); }));
    const heat=v=>`hsl(${(240*(1-(v-zlo)/((zhi-zlo)||1))).toFixed(1)},100%,75%)`;
    const hw=Math.max(44,Math.min(64,W*0.045)), cw=(W-2*m-hw)/nx, ch=(H-2*m)/(ny+1), hh=ch, ox=m+hw, oy=m+hh, CX=k=>ox+(k+0.5)*cw, CY=r=>oy+(r+0.5)*ch;
    const fx=fiA(T.x,load), fy=fiA(T.y,rpm);
    // ── MAF Curve geometry ──
    const SC=scale(), BP_=BINS.map(b=>b.v), v0=0.9, v1=Math.min(5,Math.max(...ROWS.map(b=>b.v))+0.35), Lp=m+62, Rp=m+16, Tp=m+14, covH=70, Bp=m+26+covH;
    const gw=W-Lp-Rp, gh=H-Tp-Bp, MX=v=>Lp+(v-v0)/(v1-v0)*gw;
    let glo=Infinity,ghi=-Infinity; BINS.forEach((b,i)=>{ if(b.v<v0||b.v>v1) return; for(const g of [SC[i],SC[i]*(b.n?b.f:1)]){ glo=Math.min(glo,g); ghi=Math.max(ghi,g); } }); glo*=0.9; ghi*=1.1;
    const MY=g=>Tp+gh-(Math.log(g)-Math.log(glo))/(Math.log(ghi)-Math.log(glo))*gh, gAt=v=>{ const q=fiA(BP_,v), i=Math.floor(q), j=Math.min(i+1,SC.length-1); return SC[i]+(SC[j]-SC[i])*(q-i); };
    // ── MAF Scaling geometry ──
    const rh=Math.max(16,Math.min(28,(H-2*m-30)/ROWS.length)), ty0=m+30+Math.max(0,(H-2*m-30-rh*ROWS.length)/2), RY=j=>ty0+j*rh;
    const liveJ=(()=>{ let bj=0,bd=1e9; ROWS.forEach((b,j)=>{ const d=Math.abs(b.v-mafv); if(d<bd){ bd=d; bj=j; } }); return bj; })();
    if(liveJ!==liveRow){ liveRow=liveJ; liveT=ts; }
    // ── shared drawing ──
    const span=24000/FR, gx=k=>PX-(f-k)/span*(PX-m*4), yR=r=>H*0.12+(1-(r-1800)/2400)*H*0.42, yW=w=>H*0.66+(1-(w-0.75)/0.5)*H*0.24;
    const fmtL=v=>(+v).toFixed(2), fmtR=v=>String(Math.round(v));
    const tag=(x,y,txt,maxR)=>{ c.font='800 14px system-ui,sans-serif'; c.textAlign='left'; c.textBaseline='middle'; const w=c.measureText(txt).width+10, h=24; let bx=x+10, by=y-h-8; if(bx+w>maxR) bx=x-10-w; if(by<4) by=y+8;
      c.fillStyle='rgba(0,0,0,.82)'; c.fillRect(bx,by,w,h); c.strokeStyle=RED; c.lineWidth=1.5; c.strokeRect(bx,by,w,h); c.fillStyle='#fff'; c.fillText(txt,bx+5,by+h/2+0.5); };
    const dot=(x,y,r)=>{ c.fillStyle=RED; c.strokeStyle='rgba(0,0,0,.7)'; c.lineWidth=1; c.beginPath(); c.arc(x,y,r||4.5,0,7); c.fill(); c.stroke(); };
    const rails=(x,y,hwid,vtop,vbot)=>{ c.strokeStyle=RED; c.lineWidth=2; c.shadowColor='rgba(255,0,0,.8)'; c.shadowBlur=7; c.beginPath(); c.moveTo(x,vtop??0); c.lineTo(x,vbot??H); if(hwid>0){ c.moveTo(x-hwid,y); c.lineTo(x+hwid,y); } c.stroke(); c.shadowBlur=0; };
    function drawGraph(alpha,reveal){ if(alpha<=0) return; c.globalAlpha=alpha; c.strokeStyle='#26262c'; c.lineWidth=1;
      for(let k=0;k<6;k++){ const y=H*0.1+k*H*0.16; c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); }
      // fixed integer sample points (no shimmer), exact interpolated endpoint at the playhead
      const k0=Math.ceil(f-span*reveal), kf=Math.floor(f);
      for(const [arr,col,Y,w] of [[P.w,'#b794f6',yW,2],[P.r,'#e4aa28',yR,2.6]]){ c.strokeStyle=col; c.lineWidth=w; c.lineJoin='round'; c.beginPath();
        for(let k=k0;k<=kf;k++){ const x=gx(k), y=Y(arr[((k%N)+N)%N]); if(k===k0) c.moveTo(x,y); else c.lineTo(x,y); } c.lineTo(gx(f),Y(at(arr,f))); c.stroke(); }
      c.globalAlpha=1; }
    function drawTable(prog,rx,ry,fall){ const md=Math.hypot(nx,ny), fs=Math.max(8,Math.min(14,Math.min(cw/4.1,ch*0.62)));
      c.font=`${fs}px ${MONO}`; c.textAlign='center'; c.textBaseline='middle';
      for(let r=0;r<ny;r++) for(let k=0;k<nx;k++){ let a=cl((prog*1.6-Math.hypot(k-rx,r-ry)/md)/0.35,0,1), dy=0;
        if(fall!=null){ const q=ease(seg(fall,(k/nx)*0.35+(1-r/ny)*0.1,(k/nx)*0.35+(1-r/ny)*0.1+0.45)); dy=q*(H-oy-r*ch); a*=1-q; }
        if(a<=0) continue; const x=ox+k*cw, y=oy+r*ch+dy, s=0.6+0.4*ease(Math.min(a,1)), v=T.z[r][k];
        c.globalAlpha=a; c.fillStyle=heat(v); c.fillRect(x+cw*(1-s)/2,y+ch*(1-s)/2,cw*s-1,ch*s-1);
        if(a>0.85){ c.fillStyle='#000'; c.fillText(v.toFixed(1),x+cw/2,y+ch/2+0.5); } }
      const ha=cl(prog*1.4-0.3,0,1)*(fall!=null?1-seg(fall,0,0.4):1); if(ha>0){ c.globalAlpha=ha; c.fillStyle='#0e0e12'; c.fillRect(m,m,W-2*m,hh); c.fillRect(m,m,hw,H-2*m);
        c.fillStyle='#9a9aa2'; c.fillText('deg',m+hw/2,m+hh/2); for(let k=0;k<nx;k++) c.fillText(fmtL(T.x[k]),CX(k),m+hh/2);
        c.textAlign='right'; for(let r=0;r<ny;r++) c.fillText(fmtR(T.y[r]),m+hw-6,CY(r)); c.textAlign='center'; }
      c.globalAlpha=1; }
    function drawTrace(sx,sy){ const ix=Math.floor(sx), iy=Math.floor(sy), ix1=Math.min(ix+1,nx-1), iy1=Math.min(iy+1,ny-1), ax=sx-ix, ay=sy-iy, x=CX(sx), y=CY(sy);
      [[ix,iy,(1-ax)*(1-ay)],[ix1,iy,ax*(1-ay)],[ix,iy1,(1-ax)*ay],[ix1,iy1,ax*ay]].forEach(q=>{ if(q[2]<0.02) return; c.fillStyle=`rgba(255,30,30,${(0.06+0.16*q[2]).toFixed(3)})`; c.fillRect(ox+q[0]*cw,oy+q[1]*ch,cw,ch); });
      const bx1=ax>0.02?ix1:ix, by1=ay>0.02?iy1:iy, L0=ox+ix*cw, R0=ox+(bx1+1)*cw, T0=oy+iy*ch, B0=oy+(by1+1)*ch;
      c.strokeStyle=RED; c.lineWidth=2; c.shadowColor='rgba(255,0,0,.8)'; c.shadowBlur=6; c.beginPath();
      c.moveTo(x,oy); c.lineTo(x,T0); c.moveTo(x,B0); c.lineTo(x,H-m); c.moveTo(ox,y); c.lineTo(L0,y); c.moveTo(R0,y); c.lineTo(W-m,y); c.stroke();
      c.lineWidth=2.5; c.strokeRect(L0+1.25,T0+1.25,R0-L0-2.5,B0-T0-2.5); c.shadowBlur=0; dot(x,y,Math.max(2.5,Math.min(4,ch*0.14)));
      c.font=`700 ${Math.max(9,Math.min(13,hh*0.72))}px system-ui,sans-serif`; c.textBaseline='middle'; c.textAlign='center';
      const pill=(cx,cy,txt,minW,maxR,h)=>{ const w=Math.max(minW,c.measureText(txt).width+8), lx=Math.max(m,Math.min(maxR-w,cx-w/2)); c.fillStyle=RED; c.fillRect(lx,cy-h/2,w,h); c.fillStyle='#fff'; c.fillText(txt,lx+w/2,cy+0.5); };
      pill(x,m+hh/2,fmtL(load),cw*0.9,W-m,hh-2); pill(m+hw/2,y,fmtR(rpm),hw-2,m+hw,ch-2);
      const v=(T.z[iy][ix]*(1-ax)+T.z[iy][ix1]*ax)*(1-ay)+(T.z[iy1][ix]*(1-ax)+T.z[iy1][ix1]*ax)*ay, tx=v.toFixed(1)+'°';
      c.font=`800 ${Math.max(11,Math.min(16,ch*0.95))}px system-ui,sans-serif`; const w=c.measureText(tx).width+10, h=Math.max(14,Math.min(26,ch*1.15));
      let bx=R0+4, by=T0-h-4; if(bx+w>W-m) bx=L0-4-w; if(by<oy) by=B0+4;
      c.fillStyle='rgba(0,0,0,.82)'; c.fillRect(bx,by,w,h); c.strokeStyle=RED; c.lineWidth=1.5; c.strokeRect(bx,by,w,h); c.fillStyle='#fff'; c.textAlign='left'; c.fillText(tx,bx+5,by+h/2+0.5); }
    // MAF Curve: grid + scale (grey) + corrected (amber) + bin dots + coverage bars; rev = left→right reveal
    function drawCurve(alpha,rev,covGrow){ if(alpha<=0) return; c.globalAlpha=alpha;
      c.strokeStyle='#26262c'; c.lineWidth=1; c.fillStyle='#7d7d85'; c.font=`11px ${MONO}`; c.textAlign='center'; c.textBaseline='top';
      for(let v=Math.ceil(v0*2)/2; v<=v1+1e-9; v+=0.5){ const x=MX(v); c.beginPath(); c.moveTo(x,Tp); c.lineTo(x,Tp+gh); c.stroke(); c.fillText(v.toFixed(1)+'V',x,Tp+gh+6); }
      c.textAlign='right'; c.textBaseline='middle'; for(const g of [2,5,10,20,50,100,200]){ if(g<glo||g>ghi) continue; const y=MY(g); c.strokeStyle='#1c1c22'; c.beginPath(); c.moveTo(Lp,y); c.lineTo(Lp+gw,y); c.stroke(); c.fillText(g+' g/s',Lp-6,y); }
      c.save(); c.beginPath(); c.rect(Lp,0,gw*rev,H); c.clip();
      const line=(fn,col,w)=>{ c.strokeStyle=col; c.lineWidth=w; c.beginPath(); let first=true; BINS.forEach((b,i)=>{ if(b.v<v0-0.2||b.v>v1+0.2) return; const x=MX(b.v), y=MY(fn(b,i)); if(first){ c.moveTo(x,y); first=false; } else c.lineTo(x,y); }); c.stroke(); };
      line((b,i)=>SC[i],'#7c7c82',1.5); line((b,i)=>SC[i]*(b.n?b.f:1),'#e4aa28',2.2);
      ROWS.forEach(b=>{ const x=MX(b.v), y=MY(SC[b.i]*b.f), col=b.src==='OL'?'#3baf84':b.src==='CL'?'#5a9fd4':'#e4aa28'; c.beginPath(); c.arc(x,y,3.5,0,7); if(b.solid){ c.fillStyle=col; c.fill(); } else { c.strokeStyle=col; c.lineWidth=1.5; c.stroke(); } });
      c.restore();
      const cg=covGrow==null?1:covGrow, cy0=H-m-6; BINS.forEach((b,i)=>{ if(b.v<v0||b.v>v1) return; const xa=MX(i?(BINS[i-1].v+b.v)/2:b.v), xb=MX(i<BINS.length-1?(b.v+BINS[i+1].v)/2:b.v), h=(b.n?6+Math.min(1,Math.log10(b.n+1)/Math.log10(300))*(covH-16):3)*cg;
        c.fillStyle=b.n?(b.solid?'#7bbf50':'#c9882a'):'#16161b'; c.fillRect(xa+0.75,cy0-h,Math.max(2,xb-xa-1.5),h); });
      c.globalAlpha=1; }
    // MAF Scaling: header + rows; live row tinted red with a left bar, pulse on change
    const COLS=[['V',0.03],['Loop',0.14],['×',0.26],['Δ%',0.46],['N',0.58]];
    const mc=v=>(v<0.88||v>1.12)?'#ff6b6b':(v<0.93||v>1.07)?'#f0a050':(v<0.97||v>1.03)?'#7bbf50':'#8a8a92';
    function drawRowText(b,y,a){ const X=p=>m+p*(W-2*m), cy=y+rh/2, fs=Math.min(13,rh*0.52);
      c.globalAlpha=a; c.textBaseline='middle'; c.textAlign='left'; c.font=`600 ${fs}px ${MONO}`; c.fillStyle='#e8e8ea'; c.fillText(b.v.toFixed(3),X(COLS[0][1]),cy);
      const lc=b.src==='OL'?['#0a2b21','#3baf84']:b.src==='CL'?['#0f2744','#5a9fd4']:['#2a2208','#e4aa28']; c.fillStyle=lc[0]; c.fillRect(X(COLS[1][1]),cy-rh*0.32,38,rh*0.64);
      c.fillStyle=lc[1]; c.font=`700 ${Math.min(11,rh*0.45)}px system-ui,sans-serif`; c.textAlign='center'; c.fillText(b.src,X(COLS[1][1])+19,cy);
      const pc=mc(b.f), pw=Math.min(88,rh*3.3), ph=rh*0.6, px0=X(COLS[2][1]); c.strokeStyle=pc; c.lineWidth=1; c.beginPath(); if(c.roundRect) c.roundRect(px0,cy-ph/2-2,pw,ph,ph/2); else c.rect(px0,cy-ph/2-2,pw,ph); c.stroke();
      c.fillStyle=pc; c.font=`600 ${fs}px ${MONO}`; c.fillText('×'+b.f.toFixed(4),px0+pw/2,cy-2);
      c.fillStyle='#1c1c22'; c.fillRect(px0,cy+ph/2,pw,2.5); c.fillStyle=b.solid?'#7bbf50':'#c9882a'; c.fillRect(px0,cy+ph/2,pw*Math.min(1,b.n/50),2.5);
      c.textAlign='left'; c.font=`${fs}px ${MONO}`; c.fillStyle=b.d>0.05?'#e0743f':b.d<-0.05?'#3baf84':'#7d7d85'; c.fillText((b.d>0?'+':'')+b.d.toFixed(2)+'%',X(COLS[3][1]),cy);
      c.fillStyle=b.solid?'#7bbf50':'#c9882a'; c.fillText(String(b.n),X(COLS[4][1]),cy); c.globalAlpha=1; }
    function drawMTable(a,rowsA){ c.globalAlpha=a; c.fillStyle='#0c0c10'; c.fillRect(m,m,W-2*m,26); c.font=`600 10.5px system-ui,sans-serif`; c.fillStyle='#8a8a92'; c.textBaseline='middle';
      COLS.forEach(([t,p])=>{ c.textAlign='left'; c.fillText(t.toUpperCase(),m+p*(W-2*m),m+13); }); c.globalAlpha=1;
      ROWS.forEach((b,j)=>{ const y=RY(j), ra=rowsA?rowsA(j):1; if(ra<=0) return; c.globalAlpha=ra*0.9; c.fillStyle=b.src==='OL'?'rgba(59,175,132,.07)':b.src==='CL'?'rgba(90,159,212,.05)':'rgba(228,170,40,.05)'; c.fillRect(m,y,W-2*m,rh-1);
        c.fillStyle='#121216'; c.fillRect(m,y+rh-1,W-2*m,1); drawRowText(b,y,ra*a); }); }
    function liveHi(a){ const y=RY(liveRow), pulse=Math.max(0,1-(ts-liveT)/500); c.globalAlpha=a; c.fillStyle=`rgba(255,30,30,${(0.13+0.25*pulse).toFixed(3)})`; c.fillRect(m,y,W-2*m,rh-1); c.fillStyle=RED; c.fillRect(m,y,3,rh-1); c.globalAlpha=1; }

    // ── scenes: each draws itself at progress p; nd = leave the red dot to the wipe ──
    const RB=(x,y,w,h,col,lw)=>{ c.strokeStyle=col; c.lineWidth=lw||2; c.strokeRect(x,y,w,h); };
    const box=(x,y,w,h,fill,stroke)=>{ c.fillStyle=fill; c.beginPath(); if(c.roundRect) c.roundRect(x,y,w,h,8); else c.rect(x,y,w,h); c.fill(); if(stroke){ c.strokeStyle=stroke; c.lineWidth=1; c.stroke(); } };
    const txt=(t,x,y,col,font,al)=>{ c.fillStyle=col; c.font=font; c.textAlign=al||'left'; c.textBaseline='middle'; c.fillText(t,x,y); };
    if(!BGFX_PULLS){ BGFX_PULLS=[]; let s0=-1; for(let k=0;k<=N;k++){ const on=k<N&&P.l[k]>0.8; if(on&&s0<0) s0=k; else if(!on&&s0>=0){ if(k-s0>=6){ let lo=1e9,hi=0; for(let j=s0;j<k;j++){ lo=Math.min(lo,P.r[j]); hi=Math.max(hi,P.r[j]); } BGFX_PULLS.push({a:s0,b:k-1,lo:Math.round(lo/50)*50,hi:Math.round(hi/50)*50}); } s0=-1; } } }
    if(!frame.vis||frame.vis.k!==nx+'x'+ny){ const v=new Set(); for(let k=0;k<N;k++) v.add(Math.round(fiA(T.y,P.r[k]))+','+Math.round(fiA(T.x,P.l[k]))); frame.vis={k:nx+'x'+ny,v}; }
    const KT=[]; for(let k=0;k<N;k++) if(P.l[k]>1.05&&k%11===0) KT.push(k);
    // camera: zoom z around a focus point (fx,fy) in screen space, optionally sliding the focus to (tx,ty)
    const CAM=(z,fx0,fy0,fn,tx,ty)=>{ c.save(); c.translate(tx??fx0,ty??fy0); c.scale(z,z); c.translate(-fx0,-fy0); fn(); c.restore(); };
    const fmtT2=k=>{ const s2=Math.round(k/FR*2+600); return Math.floor(s2/60)+':'+String(s2%60).padStart(2,'0'); };
    const SC_={};
    // 1 · Graph: RPM, wideband, knock lane with ticks and a hover tooltip
    const yK=H*0.9, kTick=()=>{ let near=null; for(const k of KT){ const x=gx(k); if(x<m+40||x>PX-20) continue; if(!near||Math.abs(x-(PX-W*0.18))<Math.abs(near.x-(PX-W*0.18))) near={x,k}; } return near; };
    SC_.graph={ draw(p,nd){ drawGraph(1,1); c.strokeStyle='#1c1c22'; c.lineWidth=1; c.beginPath(); c.moveTo(0,yK); c.lineTo(W,yK); c.stroke();
        for(const k of KT){ const x=gx(k); if(x<0||x>PX) continue; c.fillStyle='#eb2323'; c.fillRect(x-1.5,yK-16,3,16); }
        txt('RPM',m+6,H*0.1-12,'#e4aa28',`700 11px ${MONO}`); txt('Wideband λ',m+50,H*0.1-12,'#b794f6',`700 11px ${MONO}`); txt('Knock',m+6,yK-26,'#eb2323',`700 11px ${MONO}`);
        const near=kTick(), q=seg(p,0.35,0.45)*(1-seg(p,0.85,0.95)); if(near&&q>0){ c.globalAlpha=q; c.strokeStyle='rgba(255,255,255,.5)'; c.setLineDash([3,3]); c.beginPath(); c.moveTo(near.x,yK-16); c.lineTo(near.x,yK-60); c.stroke(); c.setLineDash([]); pill(near.x,yK-72,`${fmtT2(near.k)} · Knock · FBKC −1.41° · sustained`,'#ff6b6b'); c.globalAlpha=1; }
        rails(PX,0,0); if(!nd) dot(PX,yR(rpm)); } };
    // 2 · Tables: heat map, live trace, unvisited dimmed, knock windows; camera drifts in on the trace and back out
    const tblDraw=(zt)=>{ drawTable(1,fx,fy); const V=frame.vis.v; c.fillStyle='rgba(0,0,0,.6)'; for(let r=0;r<ny;r++) for(let k=0;k<nx;k++) if(!V.has(r+','+k)) c.fillRect(ox+k*cw,oy+r*ch,cw,ch);
      const kw=(l0,r0,r1,col)=>{ const x0=ox+Math.round(fiA(T.x,l0))*cw, y0=oy+Math.round(fiA(T.y,r0))*ch, y1=oy+(Math.round(fiA(T.y,r1))+1)*ch; c.setLineDash([6,4]); c.strokeStyle='rgba(0,0,0,.45)'; c.lineWidth=3; c.strokeRect(x0+1,y0+1,W-m-x0-2,y1-y0-2); c.strokeStyle=col; c.lineWidth=1.5; c.strokeRect(x0+1,y0+1,W-m-x0-2,y1-y0-2); c.setLineDash([]); };
      kw(0.6,1300,6800,'#00d8ff'); kw(1.2,2100,6000,'#00f060'); if(px==null){ px=fx; py=fy; } if(zt!==false){ px+=(fx-px)*0.12; py+=(fy-py)*0.12; } drawTrace(px,py); };
    SC_.tables={ draw(p,nd){ const z=1+0.35*ease(seg(p,0.15,0.4))*(1-ease(seg(p,0.65,0.9))); if(px==null){ px=fx; py=fy; } CAM(z,CX(px),CY(py),()=>tblDraw()); } };
    // 3 · Edit mode: camera pushes into the block, drag-select, right-click menu, ×0.98, cyan changed outlines
    const SEL={c0:6,c1:8,r0:5,r1:6}, selC=()=>[ox+(SEL.c0+SEL.c1+1)/2*cw,oy+(SEL.r0+SEL.r1+1)/2*ch];
    const editTable=(p,g)=>{ const done=p>0.72; const sv=T.z; T.z=T.z.map((row,r)=>row.map((v,k)=>done&&k>=SEL.c0&&k<=SEL.c1&&r>=SEL.r0&&r<=SEL.r1?v*0.98:v)); drawTable(1,0,0); T.z=sv;
      const c1=lerp(SEL.c0,SEL.c1,g), r1=lerp(SEL.r0,SEL.r1,g), sx=ox+SEL.c0*cw, sy=oy+SEL.r0*ch, sw=(c1-SEL.c0+1)*cw, sh=(r1-SEL.r0+1)*ch;
      if(g>0){ c.fillStyle='rgba(228,170,40,.16)'; c.fillRect(sx,sy,sw,sh); RB(sx,sy,sw,sh,'#e4aa28',2); }
      if(done){ c.strokeStyle='#5ad1e6'; c.lineWidth=2; for(let r=SEL.r0;r<=SEL.r1;r++) for(let k=SEL.c0;k<=SEL.c1;k++) c.strokeRect(ox+k*cw+2,oy+r*ch+2,cw-4,ch-4); } return [sx,sy,sw,sh]; };
    const amberFrame=(q)=>{ if(q<=0) return; const L2=2*(W+H)-8; c.strokeStyle='#e4aa28'; c.lineWidth=3; c.setLineDash([L2*q,L2]); c.strokeRect(2,2,W-4,H-4); c.setLineDash([]); };
    const editBadge=(n,q)=>{ c.globalAlpha=q; box(m+4,m+3,n?118:98,hh-6,'#e4aa28'); txt(n?'✎ EDITING · '+n:'✎ EDITING',m+12,m+hh/2,'#000',`800 11px system-ui,sans-serif`); c.globalAlpha=1; };
    SC_.edit={ draw(p,nd){ const [cx0,cy0]=selC(), z=lerp(1.45,1,ease(seg(p,0,0.18)))+0.45*ease(seg(p,0.36,0.46))*(1-ease(seg(p,0.7,0.82)));
        CAM(z,cx0,cy0,()=>{ const [sx,sy,sw,sh]=editTable(p,1);
          const mo=seg(p,0.4,0.45)*(1-seg(p,0.58,0.62)); if(mo>0){ const mx=sx+sw*0.7, my=sy+sh*0.6, items=['Set value…','Add / subtract…','Multiply…','Change by %…','Interpolate','Smooth','Copy','Revert to loaded'], mw=200, mh=items.length*24+26;
            c.globalAlpha=mo; box(mx,my,mw,mh,'#0b0b0e','#33333b'); txt('6 CELLS · BASE TIMING',mx+10,my+13,'#8a8a92',`600 10px ${MONO}`);
            items.forEach((t,i)=>{ const y=my+26+i*24, hot=i===2&&p>0.5; if(hot){ c.fillStyle='#2a2208'; c.fillRect(mx+4,y,mw-8,22); } txt(t,mx+12,y+11,hot?'#e4aa28':'#e8e8ea',`12.5px system-ui,sans-serif`); txt(['=','+','*','%','I','S','Ctrl+C','Del'][i],mx+mw-10,y+11,'#5c5c66',`10.5px ${MONO}`,'right'); }); c.globalAlpha=1; }
          const dq=seg(p,0.6,0.63)*(1-seg(p,0.7,0.74)); if(dq>0){ c.globalAlpha=dq; const bw=200, bx=cx0-bw/2, by=cy0-34; box(bx,by,bw,64,'#0b0b0e','#e4aa28'); txt('Multiply by',bx+12,by+16,'#e4aa28',`700 12px system-ui,sans-serif`); box(bx+12,by+28,bw-24,24,'#000','#33333b'); txt('0.98',bx+20,by+40,'#e8e8ea',`600 13px ${MONO}`); c.globalAlpha=1; }
          if(!nd) dot(sx+sw/2,sy+sh/2); });
        amberFrame(1); editBadge(p>0.72?6:0,1); } };
    // 4 · Suggestions: the grouped-cards window, Apply, then the pull ripples into the table while the camera dives in and out
    const KC={r:5,k:6}, PULL={'5,6':-2.0,'5,7':-2.0,'4,6':-1.4,'6,6':-1.4,'5,5':-1.4,'4,7':-1.05,'6,7':-1.05,'5,8':-1.0,'4,5':-0.7};
    const sugWin=(slide,hot)=>{ const ww=Math.min(560,W*0.6), wx=W/2-ww/2, wh=Math.min(H*0.78,420), wy=H/2-wh/2+slide*(H*0.75); if(wy>H) return;
      c.fillStyle=`rgba(0,0,0,${(0.55*(1-slide)).toFixed(2)})`; c.fillRect(0,0,W,H); box(wx,wy,ww,wh,'#000','#1c1c22'); txt('Suggestions',wx+18,wy+26,'#e8e8ea',`700 19px system-ui,sans-serif`);
      [['CHANGES','9'],['TABLES','1'],['BIGGEST','−2.0°']].forEach(([a,b],i)=>{ const bw=(ww-36-16)/3, bx=wx+18+i*(bw+8); box(bx,wy+44,bw,46,'#000','#1c1c22'); txt(a,bx+10,wy+57,'#8a8a92',`600 9.5px ${MONO}`); txt(b,bx+10,wy+76,i===2?'#5ad1e6':'#e8e8ea',`700 17px ${MONO}`); });
      const cy=wy+102; box(wx+18,cy,ww-36,wh-160,'#000','#1c1c22'); box(wx+18,cy,ww-36,34,'#060608'); c.fillStyle='#e4aa28'; c.beginPath(); if(c.roundRect) c.roundRect(wx+28,cy+9,28,16,8); c.fill();
      txt('Knock area',wx+66,cy+17,'#e8e8ea',`700 13.5px system-ui,sans-serif`); txt('Base timing · Cruise · 9 cells',wx+ww-28,cy+17,'#8a8a92',`11px ${MONO}`,'right');
      let chx=wx+28; for(const [t,w] of [['13 sustained events',1],['2 logs',0],['FBKC −5.00°',1],['capped at 2°',0]]){ c.font=`600 10px ${MONO}`; const tw=c.measureText(t).width+12; c.strokeStyle=w?'#5a3a10':'#33333b'; c.lineWidth=1; c.beginPath(); if(c.roundRect) c.roundRect(chx,cy+42,tw,17,8); c.stroke(); txt(t,chx+6,cy+50.5,w?'#f0a050':'#8a8a92',`600 10px ${MONO}`); chx+=tw+5; }
      [['0.78 g/rev · 2800 rpm','20.4°','18.4°'],['0.94 g/rev · 2800 rpm','15.9°','13.9°'],['0.58 g/rev · 2800 rpm','31.0°','29.6°'],['0.78 g/rev · 3200 rpm','25.0°','23.9°']].forEach(([a,b2,d2],i)=>{ const y=cy+76+i*26; if(y>cy+wh-170) return; txt(a,wx+30,y,'#e8e8ea',`12px ${MONO}`); txt(b2+'  →',wx+ww-110,y,'#5c5c66',`12px ${MONO}`,'right'); txt(d2,wx+ww-70,y,'#e8e8ea',`700 12px ${MONO}`,'right'); c.fillStyle='#e4aa28'; c.beginPath(); if(c.roundRect) c.roundRect(wx+ww-58,y-8,28,16,8); c.fill(); });
      const by=wy+wh-44; txt('9 changes selected',wx+18,by+14,'#8a8a92',`12px ${MONO}`); box(wx+ww-96,by,78,30,hot?'#ffd27a':'#e4aa28'); txt('APPLY',wx+ww-57,by+15,'#000',`800 11.5px system-ui,sans-serif`,'center'); };
    const rippleTable=(wv)=>{ const sv=T.z; T.z=T.z.map((row,r)=>row.map((v,k)=>{ const d=PULL[r+','+k]; if(!d) return v; const dist=Math.hypot(r-KC.r,k-KC.k); return v+d*seg(wv,dist/4,dist/4+0.3); })); drawTable(1,0,0); T.z=sv;
      for(const [key,d] of Object.entries(PULL)){ const [r,k]=key.split(',').map(Number), dist=Math.hypot(r-KC.r,k-KC.k), q=seg(wv,dist/4,dist/4+0.3); if(q<=0) continue; c.globalAlpha=q; c.strokeStyle='#5ad1e6'; c.lineWidth=2; c.strokeRect(ox+k*cw+2,oy+r*ch+2,cw-4,ch-4); txt(d.toFixed(1),ox+(k+1)*cw-4,oy+r*ch+8,'#5ad1e6',`800 9px ${MONO}`,'right'); c.globalAlpha=1; } };
    SC_.sug={ draw(p,nd){ const kx=ox+(KC.k+0.5)*cw, ky=oy+(KC.r+0.5)*ch, z=1+0.9*ease(seg(p,0.42,0.55))*(1-ease(seg(p,0.78,0.95)));
        CAM(z,kx,ky,()=>{ editTable(1,1); rippleTable(seg(p,0.5,0.85)); if(p>0.45&&p<0.62){ const rr=(ts/6%40); c.strokeStyle=`rgba(255,30,30,${(1-rr/40).toFixed(2)})`; c.lineWidth=2; c.beginPath(); c.arc(kx,ky,8+rr,0,7); c.stroke(); } if(!nd&&p>0.45) dot(kx,ky); });
        amberFrame(1); editBadge(p>0.85?15:6,1); sugWin(ease(seg(p,0.32,0.44)),p>0.26&&p<0.34); } };
    // 5 · MAF Tools: zoned list, overview strip, side panel, live row
    const LG=()=>{ const sw=Math.min(340,W*0.28), lx=m, lw=W-2*m-sw-12, top=m+28, zn=[['IDLE',0,1.2],['CRUISE',1.2,1.9],['LOAD',1.9,2.5],['BOOST',2.5,9]]; const rows=[]; let y=top+8, rh2=Math.max(16,Math.min(24,(H-top-120)/ROWS.length));
      for(const [nm,a,b] of zn){ const rs=ROWS.filter(q=>q.v>=a&&q.v<b); if(!rs.length) continue; rows.push({z:nm,y,rs}); y+=24; rs.forEach(q=>{ rows.push({q,y}); y+=rh2; }); } return {sw,lx,lw,top,rows,rh2}; };
    const mafStrip=()=>{ const live=ROWS[liveRow], sW=W-2*m; BINS.forEach((b,i)=>{ const w=sW/BINS.length, row=ROWS.find(q=>q.i===i); c.fillStyle=row?mc(row.f):'#141418'; c.fillRect(m+i*w,m+4,w-1,14); if(live&&live.i===i){ c.strokeStyle=RED; c.lineWidth=2; c.strokeRect(m+i*w,m+4,w-1,14); } }); };
    const liveBarPos=()=>{ const G=LG(), live=ROWS[liveRow], r=live&&G.rows.find(x=>x.q&&x.q.i===live.i); if(!r) return null; let mx2=5; ROWS.forEach(q=>mx2=Math.max(mx2,Math.abs(q.d))); mx2=Math.min(15,mx2); const bx0=G.lx+100, bw=G.lw-280, mid=bx0+bw/2, wd=Math.min(bw/2,Math.abs(live.d)/mx2*bw/2); return {x:live.d<0?mid-wd:mid,y:r.y+G.rh2*0.25,w:wd,h:G.rh2*0.5,col:mc(live.f)}; };
    SC_.maf={ draw(p,nd){ const G=LG(), live=ROWS[liveRow]; let mx2=5; ROWS.forEach(q=>mx2=Math.max(mx2,Math.abs(q.d))); mx2=Math.min(15,mx2); mafStrip();
        for(const r of G.rows){ if(r.z){ let sw2=0,sn=0; r.rs.forEach(q=>{ sw2+=q.d*q.n; sn+=q.n; }); const av=sn?sw2/sn:0; txt('▾ '+r.z,G.lx+12,r.y+12,'#5c5c66',`600 10.5px ${MONO}`); txt('avg '+(av>0?'+':'')+av.toFixed(2)+'%',G.lx+G.lw-12,r.y+12,Math.abs(av)>=6?'#ff6b6b':Math.abs(av)>=3?'#f0a050':'#7bbf50',`600 12px ${MONO}`,'right'); continue; }
          const q=r.q, y=r.y, h=G.rh2, isL=live&&q.i===live.i; if(isL){ c.fillStyle='rgba(255,30,30,.13)'; c.fillRect(G.lx,y,G.lw,h); }
          c.fillStyle=q.src==='OL'?'#3baf84':q.src==='CL'?'#5a9fd4':'#e4aa28'; c.fillRect(G.lx+12,y+3,6,h-6); txt(q.v.toFixed(3),G.lx+30,y+h/2,isL?'#ff6b6b':'#e8e8ea',`700 ${Math.min(13,h*0.6)}px ${MONO}`);
          const bx0=G.lx+100, bw=G.lw-280, mid=bx0+bw/2, wd=Math.min(bw/2,Math.abs(q.d)/mx2*bw/2); c.fillStyle='#2e2e36'; c.fillRect(mid,y+2,1,h-4); c.fillStyle=mc(q.f); if(q.d<0) c.fillRect(mid-wd,y+h*0.25,wd,h*0.5); else c.fillRect(mid,y+h*0.25,wd,h*0.5);
          txt('×'+q.f.toFixed(4),G.lx+G.lw-80,y+h/2,mc(q.f),`700 ${Math.min(13,h*0.6)}px ${MONO}`,'right'); txt(String(q.n),G.lx+G.lw-16,y+h/2,q.solid?'#7bbf50':'#c9882a',`${Math.min(12,h*0.55)}px ${MONO}`,'right'); }
        const px2=W-m-G.sw; c.fillStyle='#1c1c22'; c.fillRect(px2-6,G.top,1,H-G.top-m); if(live){ txt(live.v.toFixed(3)+' V · BIN '+(live.i+1),px2+10,G.top+20,'#8a8a92',`700 12px ${MONO}`); txt('×'+live.f.toFixed(4),px2+10,G.top+56,mc(live.f),`700 ${Math.min(40,G.sw*0.13)}px ${MONO}`);
          txt((live.d>0?'+':'')+live.d.toFixed(2)+'% · '+live.src+' · n '+live.n,px2+10,G.top+90,mc(live.f),`600 13px ${MONO}`); const sx1=px2+10, sw3=G.sw-24, sy1=G.top+140; c.strokeStyle='#33333b'; c.setLineDash([3,3]); c.beginPath(); c.moveTo(sx1,sy1); c.lineTo(sx1+sw3,sy1); c.stroke(); c.setLineDash([]);
          c.strokeStyle='#e4aa28'; c.lineWidth=1.6; c.beginPath(); ROWS.forEach((q,j)=>{ const x=sx1+(q.v-ROWS[0].v)/(ROWS[ROWS.length-1].v-ROWS[0].v)*sw3, y=sy1-q.d/mx2*28; if(j) c.lineTo(x,y); else c.moveTo(x,y); }); c.stroke();
          const lx2=sx1+(live.v-ROWS[0].v)/(ROWS[ROWS.length-1].v-ROWS[0].v)*sw3; c.strokeStyle=RED; c.lineWidth=1.5; c.beginPath(); c.moveTo(lx2,sy1-34); c.lineTo(lx2,sy1+34); c.stroke(); }
        if(!nd&&live){ const r=G.rows.find(x=>x.q&&x.q.i===live.i); if(r) dot(G.lx+15,r.y+G.rh2/2,3.5); } } };
    // 6 · MAF Curve with legend
    const curveLegend=()=>{ let lx=Lp+12; const ly=Tp+14; c.fillStyle='rgba(0,0,0,.75)'; c.fillRect(Lp+4,Tp+4,330,20); for(const [k,col,t] of [['l','#7c7c82','Current'],['l','#e4aa28','Corrected'],['d','#5a9fd4','CL'],['d','#3baf84','OL'],['d','#e4aa28','MIX']]){ if(k==='l'){ c.strokeStyle=col; c.lineWidth=2; c.beginPath(); c.moveTo(lx,ly); c.lineTo(lx+16,ly); c.stroke(); lx+=21; } else { c.fillStyle=col; c.beginPath(); c.arc(lx+4,ly,3.5,0,7); c.fill(); lx+=13; } txt(t,lx,ly,'#9a9aa2',`11px ${MONO}`); c.font=`11px ${MONO}`; lx+=c.measureText(t).width+14; } };
    SC_.curve={ draw(p,nd){ const g=gAt(mafv), x=MX(mafv), y=MY(g), z=1+0.4*ease(seg(p,0.3,0.5))*(1-ease(seg(p,0.75,0.95)));
        CAM(z,x,y,()=>{ drawCurve(1,1,1); c.save(); c.beginPath(); c.rect(Lp,Tp,gw,gh); c.clip(); rails(x,y,W,Tp,Tp+gh); c.restore(); if(!nd){ dot(x,y); tag(x,y,`${mafv.toFixed(3)} V · ${g.toFixed(2)} g/s`,Lp+gw); } }); curveLegend(); } };
    // 7 · Scatter with colour legend and trend line
    const scG=()=>{ const L0=m+64,T0=m+24,gw2=W-L0-m-20,gh2=H-T0-m-44; return {L0,T0,gw2,gh2,MX2:v=>L0+(v-0.1)/1.6*gw2,MY2:v=>T0+gh2-(v-0.76)/0.56*gh2}; };
    SC_.scatter={ draw(p){ const S2=scG(); sScatter(1,p); const lx=S2.L0+S2.gw2-210, ly=S2.T0+6, gr=c.createLinearGradient(lx,0,lx+130,0); gr.addColorStop(0,'hsl(240,90%,60%)'); gr.addColorStop(.5,'hsl(120,90%,60%)'); gr.addColorStop(1,'hsl(0,90%,60%)');
        c.fillStyle='rgba(0,0,0,.8)'; c.fillRect(lx-8,ly-4,214,34); c.fillStyle=gr; c.fillRect(lx,ly,130,8); txt('1,800',lx,ly+19,'#9a9aa2',`10.5px ${MONO}`); txt('4,200',lx+130,ly+19,'#9a9aa2',`10.5px ${MONO}`,'right'); txt('RPM',lx+138,ly+4,'#9a9aa2',`10.5px ${MONO}`); } };
    // 8 · Compare: one trace splits into A and B
    const yvC=v=>H*0.18+(1-(v-1800)/2400)*H*0.6, Bc=(k,sep)=>{ const a=P.r[((k%N)+N)%N]; return lerp(a,P.r[(((k+37)%N)+N)%N]*0.96+90,sep); };
    SC_.compare={ draw(p){ const sp=24000/FR, sep=ease(seg(p,0.02,0.3)); c.strokeStyle='#26262c'; c.lineWidth=1; for(let k=0;k<6;k++){ const y=H*0.1+k*H*0.16; c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); }
        const k0=Math.ceil(f-sp), kf=Math.floor(f); for(const [g,col] of [[k=>Bc(k,sep),'#5ad1e6'],[k=>P.r[((k%N)+N)%N],'#e4aa28']]){ c.strokeStyle=col; c.lineWidth=2.6; c.lineJoin='round'; c.beginPath(); for(let k=k0;k<=kf;k++){ const x=gx(k), y=yvC(g(k)); if(k===k0) c.moveTo(x,y); else c.lineTo(x,y); } c.stroke(); }
        rails(PX,0,0); c.fillStyle='#5ad1e6'; c.beginPath(); c.arc(PX,yvC(Bc(f,sep)),4.5,0,7); c.fill(); dot(PX,yvC(at(P.r,f))); c.globalAlpha=sep; pill(m+90,m+22,'A · rev 2','#e4aa28','#2a2208'); pill(m+190,m+22,'B · rev 3','#5ad1e6','#0b2a30'); c.globalAlpha=1; } };
    SC_.pulls={ draw(p){ sPulls(1,p); } };
    SC_.diag={ draw(p){ const mk2=diagMark(); const z=1+0.5*ease(seg(p,0.55,0.7))*(1-ease(seg(p,0.85,0.98))); CAM(z,mk2.x,mk2.y,()=>sDiag(1,p)); } };
    const diagMark=()=>{ const T0=H*0.5, p0=0.24; return {x:m+p0*(W-2*m),y:T0+H*0.08}; };
    // ── bespoke transitions ──
    const TR={};
    TR.graph=t=>{ const e=ease(t), d0=[PX,yR(rpm)], d1=[CX(fx),CY(fy)]; if(px==null){ px=fx; py=fy; }
      if(t<0.55){ const z=lerp(1,5,ease(seg(t,0,0.55))); c.globalAlpha=1-seg(t,0.35,0.55); CAM(z,d0[0],d0[1],()=>SC_.graph.draw(1,true),lerp(d0[0],W/2,e),lerp(d0[1],H/2,e)); c.globalAlpha=1; }
      if(t>0.4){ const z=lerp(5,1,ease(seg(t,0.4,1))); c.globalAlpha=seg(t,0.4,0.6); CAM(z,d1[0],d1[1],()=>tblDraw(false),lerp(W/2,d1[0],ease(seg(t,0.4,1))),lerp(H/2,d1[1],ease(seg(t,0.4,1)))); c.globalAlpha=1; }
      dot(t<0.5?lerp(d0[0],W/2,e):lerp(W/2,d1[0],ease(seg(t,0.4,1))),t<0.5?lerp(d0[1],H/2,e):lerp(H/2,d1[1],ease(seg(t,0.4,1))),5); };
    TR.tables=t=>{ const [cx0,cy0]=selC(), z=lerp(1,1.45,ease(t)); CAM(z,cx0,cy0,()=>{ if(t<0.35){ tblDraw(false); c.globalAlpha=1; } else { editTable(0,ease(seg(t,0.4,0.85))); } });
      c.globalAlpha=seg(t,0.3,0.45); if(t>=0.3&&t<0.45){ c.globalAlpha=1; } amberFrame(ease(seg(t,0.45,1))); if(t>0.75) editBadge(0,seg(t,0.75,0.9)); c.globalAlpha=1; };
    TR.edit=t=>{ editTable(1,1); amberFrame(1); editBadge(6,1); const bw=124, bx=W-m-bw-90, by=m+3, hot=t>0.25&&t<0.4;
      c.globalAlpha=seg(t,0,0.12); box(bx,by,bw,hh-6,hot?'#ffd27a':'#141418','#e4aa28'); txt('SUGGESTIONS',bx+bw/2,by+(hh-6)/2,hot?'#000':'#e4aa28',`800 11px system-ui,sans-serif`,'center');
      const cx2=lerp(W*0.62,bx+bw*0.6,ease(seg(t,0,0.25))), cy2=lerp(H*0.6,by+(hh-6)*0.7,ease(seg(t,0,0.25))); c.fillStyle='#fff'; c.strokeStyle='#000'; c.lineWidth=1; c.beginPath(); c.moveTo(cx2,cy2); c.lineTo(cx2,cy2+16); c.lineTo(cx2+4.5,cy2+12); c.lineTo(cx2+11,cy2+12); c.closePath(); c.fill(); c.stroke(); c.globalAlpha=1;
      if(t>0.35) sugWin(1-ease(seg(t,0.35,0.85)),false); };
    TR.sug=t=>{ const e=ease(seg(t,0,0.55)), y0=m+4, sv=c.globalAlpha;
      if(t<0.6){ c.save(); c.translate(0,y0); c.scale(1,lerp(1,0.018,e)); c.translate(0,-y0); c.globalAlpha=1-seg(t,0.35,0.6)*0.5; editTable(1,1); rippleTable(1); c.restore(); c.globalAlpha=sv; }
      if(t>0.45){ const r=ease(seg(t,0.45,1)); mafStrip(); c.save(); c.beginPath(); c.rect(0,m+20,W,(H-m-20)*r); c.clip(); SC_.maf.draw(0,true); c.restore(); } };
    TR.maf=t=>{ const b0=liveBarPos(), g=gAt(mafv), dx=MX(mafv), dy=MY(g); c.globalAlpha=1-seg(t,0,0.4); SC_.maf.draw(1,true); c.globalAlpha=1;
      if(t>0.3){ c.globalAlpha=seg(t,0.3,0.6); drawCurve(1,ease(seg(t,0.35,1)),ease(seg(t,0.4,1))); curveLegend(); c.globalAlpha=1; }
      if(b0){ const q=ease(seg(t,0.1,0.75)), w=lerp(b0.w,9,q), h=lerp(b0.h,9,q), x=lerp(b0.x+b0.w/2,dx,q), y=lerp(b0.y+b0.h/2,dy,q); c.fillStyle=q>0.95?RED:b0.col; c.beginPath(); if(c.roundRect) c.roundRect(x-w/2,y-h/2,w,h,Math.min(w,h)/2*q); else c.rect(x-w/2,y-h/2,w,h); c.fill(); } };
    TR.curve=t=>{ const S2=scG(), e=ease(seg(t,0.15,0.9)); c.globalAlpha=1-seg(t,0,0.3); drawCurve(1,1,1); curveLegend(); c.globalAlpha=1; if(t>0.75){ c.globalAlpha=seg(t,0.75,1); sScatter(1,0); c.globalAlpha=1; }
      const n=Math.min(N,420); for(let k=0;k<n;k++){ const kk=Math.floor(k*N/n), b=ROWS[k%ROWS.length], sx=MX(b.v), sy=MY(SC[b.i]*b.f), ex=S2.MX2(P.l[kk]), ey=S2.MY2(Math.min(1.3,P.w[kk])), jit=Math.sin(k*12.9898)*40*(1-e)*e;
        c.globalAlpha=1-seg(t,0.85,1); c.fillStyle=`hsla(${(240*(1-cl((P.r[kk]-1800)/2400,0,1))).toFixed(0)},90%,60%,.8)`; c.fillRect(lerp(sx,ex,e)-2+jit,lerp(sy,ey,e)-2-jit*0.6,4,4); } c.globalAlpha=1; };
    TR.scatter=t=>{ const S2=scG(), F=sScatter.F||{a:1,b:0}; c.globalAlpha=1-seg(t,0,0.4); sScatter(1,1); c.globalAlpha=1; const sp=24000/FR, k0=Math.ceil(f-sp), kf=Math.floor(f), e=ease(seg(t,0.1,0.85));
      c.strokeStyle=e>0.5?'#e4aa28':'#ffffff'; c.lineWidth=lerp(2,2.6,e); c.beginPath(); for(let k=k0;k<=kf;k++){ const u=(k-k0)/(kf-k0||1), xa=lerp(S2.MX2(0.1),S2.MX2(1.7),u), lv=0.1+1.6*u, ya=S2.MY2(F.a+F.b*lv), xb=gx(k), yb=yvC(P.r[((k%N)+N)%N]); const x=lerp(xa,xb,e), y=lerp(ya,yb,e); if(k===k0) c.moveTo(x,y); else c.lineTo(x,y); } c.stroke();
      if(t>0.8){ c.globalAlpha=seg(t,0.8,1); rails(PX,0,0); dot(PX,yvC(at(P.r,f))); c.globalAlpha=1; } };
    TR.compare=t=>{ const e=ease(seg(t,0.05,0.85)), sp=24000/FR, Xw=k=>m+k/(N-1)*(W-2*m), Yp=v=>H*0.25+(1-(v-1800)/2400)*H*0.55, fk=((Math.floor(f)%N)+N)%N;
      c.globalAlpha=1-seg(t,0,0.35); c.strokeStyle='#5ad1e6'; c.lineWidth=2.6; c.beginPath(); const k0=Math.ceil(f-sp), kf=Math.floor(f); for(let k=k0;k<=kf;k++){ const x=gx(k), y=yvC(Bc(k,1)); if(k===k0) c.moveTo(x,y); else c.lineTo(x,y); } c.stroke(); c.globalAlpha=1;
      c.strokeStyle=e>0.6?'#7c7c82':'#e4aa28'; c.lineWidth=lerp(2.6,2,e); c.beginPath(); let first=true; for(let k=0;k<N;k++){ const kw=f-((fk-k+N)%N), xa=gx(kw), xb=Xw(k), x=lerp(xa,xb,e), y=lerp(yvC(P.r[k]),Yp(P.r[k]),e); if(xa<-50&&e<0.05) continue; if(first){ c.moveTo(x,y); first=false; } else c.lineTo(x,y); } c.stroke();
      c.globalAlpha=1-e; rails(PX,0,0); c.globalAlpha=1; };
    TR.pulls=t=>{ const e=ease(seg(t,0.1,0.8)), X=k=>m+k/(N-1)*(W-2*m), Y=v=>H*0.25+(1-(v-1800)/2400)*H*0.55, T0=H*0.5, th=H*0.16;
      c.globalAlpha=1-seg(t,0,0.4); c.strokeStyle='#7c7c82'; c.lineWidth=2; c.beginPath(); for(let k=0;k<N;k++){ if(k) c.lineTo(X(k),Y(P.r[k])); else c.moveTo(X(k),Y(P.r[k])); } c.stroke(); c.globalAlpha=1;
      if(t>0.4){ c.globalAlpha=seg(t,0.4,0.8); c.fillStyle='#0b0b0e'; c.fillRect(m,T0,W-2*m,th); c.strokeStyle='#1c1c22'; c.strokeRect(m,T0,W-2*m,th); c.fillStyle='rgba(124,124,130,.55)'; for(let k=0;k<N;k++){ const h=(P.r[k]-1800)/2400*(th-12); c.fillRect(X(k),T0+th-6-h,Math.max(1,(W-2*m)/N),h); } c.globalAlpha=1; }
      const sv=['warn','crit','info']; BGFX_PULLS.forEach((p2,i)=>{ const x0=X(p2.a), x1=X(p2.b), cxp=(x0+x1)/2, yt=Y(p2.hi)-14, yb=Y(p2.lo)+14, w=lerp(x1-x0+8,3,e), tY=lerp(yt,T0-4,e), bY=lerp(yb,T0+th+4,e), col=e>0.7?sevC(sv[i%3]):'#e4aa28';
        c.fillStyle=e>0.7?col:'rgba(228,170,40,.12)'; c.fillRect(cxp-w/2,tY,w,bY-tY); c.strokeStyle=col; c.lineWidth=2; c.strokeRect(cxp-w/2,tY,w,bY-tY); }); };
    TR.diag=t=>{ const mk2=diagMark(), near=kTick(), tx=near?near.x:PX-W*0.18, ty=yK-8;
      if(t<0.55){ const z=lerp(1,6,ease(seg(t,0,0.55))); c.globalAlpha=1-seg(t,0.35,0.55); CAM(z,mk2.x,mk2.y,()=>sDiag(1,1),lerp(mk2.x,W/2,ease(seg(t,0,0.55))),lerp(mk2.y,H/2,ease(seg(t,0,0.55)))); c.globalAlpha=1; }
      if(t>0.4){ const q=ease(seg(t,0.4,1)), z=lerp(6,1,q); c.globalAlpha=seg(t,0.4,0.6); CAM(z,tx,ty,()=>SC_.graph.draw(0,true),lerp(W/2,tx,q),lerp(H/2,ty,q)); c.globalAlpha=1; } };
    if(ph[0]==='w'){ const i=+ph.slice(1); TR[SQ[i][0]](pt); }
    else { if(ph!=='tables') { px=null; py=null; } SC_[ph].draw(pt,false); }
    function grid(L0,T0,gw,gh){ c.strokeStyle='#26262c'; c.lineWidth=1; for(let k=0;k<=4;k++){ const x=L0+gw*k/4, y=T0+gh*k/4; c.beginPath(); c.moveTo(x,T0); c.lineTo(x,T0+gh); c.moveTo(L0,y); c.lineTo(L0+gw,y); c.stroke(); } }
    function pill(x,y,txt0,col,bg){ c.font=`700 12px system-ui,sans-serif`; c.textAlign='left'; c.textBaseline='middle'; const w=c.measureText(txt0).width+14, h=22; const bx=Math.max(m,Math.min(W-m-w,x-w/2));
      c.fillStyle=bg||'rgba(0,0,0,.85)'; c.fillRect(bx,y-h/2,w,h); c.strokeStyle=col; c.lineWidth=1.5; c.strokeRect(bx,y-h/2,w,h); c.fillStyle=col; c.fillText(txt0,bx+7,y+0.5); }
    function sScatter(a,prog){ if(a<=0) return; c.globalAlpha=a; const L0=m+64,T0=m+24,gw=W-L0-m-20,gh=H-T0-m-44, x0=0.1,x1=1.7,y0=0.76,y1=1.32, MX=v=>L0+(v-x0)/(x1-x0)*gw, MY=v=>T0+gh-(v-y0)/(y1-y0)*gh;
      grid(L0,T0,gw,gh); c.fillStyle='#7d7d85'; c.font=`11px ${MONO}`; c.textAlign='center'; c.textBaseline='top'; for(let k=0;k<=4;k++) c.fillText((x0+(x1-x0)*k/4).toFixed(2),L0+gw*k/4,T0+gh+6);
      c.textAlign='right'; c.textBaseline='middle'; for(let k=0;k<=4;k++) c.fillText((y0+(y1-y0)*k/4).toFixed(2),L0-6,T0+gh-gh*k/4); c.textAlign='left'; c.fillText('X: Engine load · Y: Wideband λ · colour: RPM',L0,T0-12);
      const n=Math.floor(N*Math.min(1,0.12+prog*1.25)); for(let k=0;k<n;k++){ c.fillStyle=`hsla(${(240*(1-cl((P.r[k]-1800)/2400,0,1))).toFixed(0)},90%,60%,.75)`; c.fillRect(MX(P.l[k])-2,MY(Math.min(1.3,P.w[k]))-2,4,4); }
      if(!sScatter.F){ let a1=0,b1=0,c1=0,d1=0; for(let k=0;k<N;k++){ const x=P.l[k], y=Math.min(1.3,P.w[k]); a1+=x; b1+=y; c1+=x*x; d1+=x*y; } const b=(N*d1-a1*b1)/(N*c1-a1*a1); sScatter.F={a:(b1-b*a1)/N,b}; }
      const q=ease(seg(prog,0.5,0.9)); if(q>0){ const F=sScatter.F, xe=lerp(x0,x1,q); c.strokeStyle='#ffffff'; c.lineWidth=2; c.beginPath(); c.moveTo(MX(x0),MY(F.a+F.b*x0)); c.lineTo(MX(xe),MY(F.a+F.b*xe)); c.stroke(); if(q>0.95) pill(MX(x1)-80,T0+14,`slope ${F.b.toFixed(3)} · n ${N}`,'#e8e8ea'); }
      dot(MX(at(P.l,f)),MY(Math.min(1.3,at(P.w,f))),5); c.globalAlpha=1; }
    function sCompare(a){ if(a<=0) return; c.globalAlpha=a; const sp=24000/FR, yv=v=>H*0.18+(1-(v-1800)/2400)*H*0.6, B=k=>P.r[(((k+37)%N)+N)%N]*0.96+90;
      c.strokeStyle='#26262c'; c.lineWidth=1; for(let k=0;k<6;k++){ const y=H*0.1+k*H*0.16; c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); }
      const k0=Math.ceil(f-sp), kf=Math.floor(f); for(const [g,col] of [[k=>P.r[((k%N)+N)%N],'#e4aa28'],[B,'#5ad1e6']]){ c.strokeStyle=col; c.lineWidth=2.6; c.lineJoin='round'; c.beginPath(); for(let k=k0;k<=kf;k++){ const x=gx(k), y=yv(g(k)); if(k===k0) c.moveTo(x,y); else c.lineTo(x,y); } c.stroke(); }
      rails(PX,0,0); dot(PX,yv(at(P.r,f))); c.fillStyle='#5ad1e6'; c.beginPath(); c.arc(PX,yv(B(f)),4.5,0,7); c.fill();
      pill(m+90,m+22,'A · rev 2','#e4aa28','#2a2208'); pill(m+190,m+22,'B · rev 3','#5ad1e6','#0b2a30'); c.globalAlpha=1; }
    function sPulls(a,prog){ if(a<=0) return; c.globalAlpha=a; const X=k=>m+k/(N-1)*(W-2*m), Y=v=>H*0.25+(1-(v-1800)/2400)*H*0.55;
      c.strokeStyle='#26262c'; c.lineWidth=1; for(let k=0;k<5;k++){ const y=H*0.2+k*H*0.15; c.beginPath(); c.moveTo(m,y); c.lineTo(W-m,y); c.stroke(); }
      c.strokeStyle='#7c7c82'; c.lineWidth=2; c.beginPath(); for(let k=0;k<N;k++){ if(k) c.lineTo(X(k),Y(P.r[k])); else c.moveTo(X(k),Y(P.r[k])); } c.stroke();
      BGFX_PULLS.forEach((p,i)=>{ const q=ease(seg(prog,0.08+i/BGFX_PULLS.length*0.6,0.2+i/BGFX_PULLS.length*0.6)); if(q<=0) return; const x0=X(p.a), x1=X(p.b), yt=Y(p.hi)-14, yb=Y(p.lo)+14;
        c.globalAlpha=a*q; c.fillStyle='rgba(228,170,40,.12)'; c.fillRect(x0-4,yt,x1-x0+8,yb-yt); c.strokeStyle='#e4aa28'; c.lineWidth=2; c.strokeRect(x0-4,yt,x1-x0+8,yb-yt);
        pill((x0+x1)/2,yt-16-(i%2)*28,`Pull ${i+1} · ${['3rd','4th','2nd'][i%3]} gear ${p.lo.toLocaleString()}–${p.hi.toLocaleString()} rpm`,'#e4aa28','#2a2208'); c.globalAlpha=a; });
      const px=m+prog*(W-2*m); c.fillStyle='rgba(255,255,255,.85)'; c.fillRect(px-1,H*0.12,2,H*0.76); c.globalAlpha=1; }
    function sDiag(a,prog){ if(a<=0) return; c.globalAlpha=a; const T0=H*0.5, th=H*0.16, X=k=>m+k/(N-1)*(W-2*m), sev={info:'#5a9fd4',warn:'#f0c060',crit:'#ff6b6b'};
      c.fillStyle='#0b0b0e'; c.fillRect(m,T0,W-2*m,th); c.strokeStyle='#1c1c22'; c.strokeRect(m,T0,W-2*m,th); c.fillStyle='rgba(124,124,130,.55)';
      for(let k=0;k<N;k++){ const h=(P.r[k]-1800)/2400*(th-12); c.fillRect(X(k),T0+th-6-h,Math.max(1,(W-2*m)/N),h); }
      const D=[[0.1,'info','Tip-in rich dip −1.8 AFR'],[0.24,'warn','FBKC −1.41° · sustained'],[0.38,'crit','Still closed loop under boost'],[0.52,'warn','Boost oscillating around target'],[0.66,'info','AVCS intake hunting'],[0.8,'crit','IDC 91.2 % @ 6,400 rpm']];
      D.forEach(([p,sv,l],i)=>{ const q=ease(seg(prog,p*0.9,p*0.9+0.08)); if(q<=0) return; const x=m+p*(W-2*m), col=sev[sv]; c.globalAlpha=a*q; c.fillStyle=col; c.fillRect(x-1.5,T0-4,3,th+8);
        const y=T0-30-(i%2)*34; c.fillRect(x-0.5,y+11,1,T0-4-(y+11)); pill(x,y,l,col); c.globalAlpha=a; });
      const px=m+prog*(W-2*m); c.fillStyle='#fff'; c.fillRect(px-1,T0,2,th); c.globalAlpha=1; }
    raf=requestAnimationFrame(frame);
  }
  return { set(v,mode){ document.body.dataset.bg=v?(mode||''):''; if(v===on) return; on=v; if(on&&!raf) raf=requestAnimationFrame(frame); } };
})();
