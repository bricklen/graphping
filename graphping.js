#!/usr/bin/env node

var child = require('child_process');
var Fiber = require('fibers');
var blessed = require('blessed');
var contrib = require('blessed-contrib');
var screen = blessed.screen();
var argv = require('yargs')
    .usage('Usage: $0 <url_to_ping> (if no URL is supplied, google.ca is used)')
    .help('h')
    .alias('h', 'help')
    .example('$0 google.ca -y 2000', ' Pings google.ca and graphs the roundtrip latency. The "y" argument sets the upper boundary able to be graphed.' + "\nUse 'q', 'Ctrl-c', or the Escape key to exit.")
    .demand(0)
    .argv;
var url_to_ping = 'google.ca';
var max_ping = 0;
var ping_failures = 0;
var max_ping_time = '';
var max_ping_str = '';
var max_y = 1500;       // In milliseconds, greater values will not be graphed.
var err_ping = -100;    // Chose -100 so that it was clearly visible on the graph.

if ( typeof argv._[0] !== 'undefined') {
    if ((argv._[0]).length > 0 ) {
        url_to_ping = argv._[0];
    }
}
if (typeof argv.y !== 'undefined') {
    if (argv.y > 0) {
        max_y = argv.y;
    }
}

var line = contrib.line({
    style: {line: "yellow", text: "blue" , baseline: "black"}
    , xLabelPadding: 2
    , xPadding: 15
    , yPadding: 10
    , showLegend: true
    , abbreviate: false
    , wholeNumbersOnly: true //true: do not show fraction in y axis
    , height: "100%"
    , width: "100%"
    , legend: {width: 80}
    , showNthLabel: 5
    , label: 'Pinging "' + url_to_ping + '".\n' + err_ping.toString() + ' means ping failed to reach the URL.\nMax Y value is set to ' + max_y + ' ms.'
    , minY: err_ping
    , maxY: max_y
});
screen.append(line); //must append before setting data

// Keys to exit the graph
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
});

var data =
    {
        title: 'ping',
        x: [],
        y: [],
        minY: 10
    };
var baseline =
    {
        title: '0 ms',
        x: [0],
        y: [],
        style: {line: 'white'}
    };

function sleep(ms) {
    var fiber = Fiber.current;
    setTimeout(function() {
        fiber.run();
    }, ms);
    Fiber.yield();
}

var doPing = function() {
    var re = /time=[0-9]+/;
    var command = 'ping -n -c 1 ' + url_to_ping + ' | grep -Eo "time=[0-9.]+"';
    var res;
    try {
        res = child.execSync(command);
    }
    catch (e) {
        //  console.log("entering catch block");
    }

    if (typeof res === 'undefined' || typeof res.stderr !== 'undefined') {
        return err_ping;
    }
    if (re.test(res)) {
        res = /\d+/.exec(res);
    }
    return res.toString().trim();
};

Fiber(function() {
    do {
        var pingMs_legend;
        process.nextTick(function() {
            var now = new Date;
            var curr_date = now.getDate();
            var curr_month = now.getMonth();
            var curr_year = now.getFullYear();
            var curr_hour = now.getHours();
            var curr_minute = now.getMinutes();
            var curr_second = now.getSeconds();
            var cur_time_full = curr_year + '-' + curr_month + '-' + curr_date + ' '
                + curr_hour + ':' + curr_minute + ':' + curr_second;
            var cur_time = curr_hour + ':' + curr_minute + ':' + curr_second;

            var pingMs = doPing();
            if (pingMs === err_ping || typeof pingMs === 'undefined') {
                pingMs_legend = 'Ping Failed'
                ping_failures++;
            } else {
                pingMs_legend = 'Ping: ' + pingMs + ' ms';
                if (Number(pingMs) > Number(max_ping)) {
                    max_ping = Number(pingMs);
                    max_ping_str = pingMs.toString();
                    max_ping_time = cur_time_full;
                }
            }
            data.title = pingMs_legend.toString();
            data.x.push(cur_time);
            data.y.push(pingMs);
            baseline.x.push(cur_time);
            baseline.y.push(0);
            baseline.title = 'Max ping: ' + max_ping_str + ' ms, at ' + max_ping_time + '. Failed pings: ' + ping_failures.toString();
            line.setData([data, baseline]);
            screen.render();
        });
        sleep(1000);
    } while (true);
}).run();



