export class VizHub {
    constructor(containerId, config = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        this.config = {
            margin: { top: 20, right: 20, bottom: 40, left: 50 },
            bgColor: "transparent",
            ...config
        };

        this.width = 0;
        this.height = 0;
        this.svg = null;
        this.mainGroup = null;

        // Auto-init
        this.init();
        
        // Resize listener
        window.addEventListener('resize', () => this.resize());
    }

    init() {
        this.container.innerHTML = '';
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;

        this.svg = d3.select(this.container)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`)
            .style("background", this.config.bgColor);

        this.mainGroup = this.svg.append("g")
            .attr("transform", `translate(${this.config.margin.left}, ${this.config.margin.top})`);
        
        this.innerWidth = this.width - this.config.margin.left - this.config.margin.right;
        this.innerHeight = this.height - this.config.margin.top - this.config.margin.bottom;
    }

    resize() {
        // Debounce or just re-init for simplicity in MVP
        this.init();
        // Dispatch 'redraw' event if needed by consumer
    }

    // --- Helpers ---

    createCartesianGrid(xDomain = [-10, 10], yDomain = [-10, 10]) {
        const xScale = d3.scaleLinear()
            .domain(xDomain)
            .range([0, this.innerWidth]);

        const yScale = d3.scaleLinear()
            .domain(yDomain)
            .range([this.innerHeight, 0]);

        // Grid lines
        const xAxis = d3.axisBottom(xScale).ticks(10).tickSize(-this.innerHeight).tickPadding(10);
        const yAxis = d3.axisLeft(yScale).ticks(10).tickSize(-this.innerWidth).tickPadding(10);

        const gX = this.mainGroup.append("g")
            .attr("class", "grid x-grid")
            .attr("transform", `translate(0, ${this.innerHeight})`)
            .call(xAxis);

        const gY = this.mainGroup.append("g")
            .attr("class", "grid y-grid")
            .call(yAxis);

        // Styling for dark mode
        this.mainGroup.selectAll(".domain").style("stroke", "rgba(255,255,255,0.1)");
        this.mainGroup.selectAll(".tick line").style("stroke", "rgba(255,255,255,0.05)");
        this.mainGroup.selectAll(".tick text").style("fill", "rgba(255,255,255,0.5)");

        return { xScale, yScale };
    }

    plotFunction(data, xScale, yScale, color = "#00f0ff") {
        const line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y))
            .curve(d3.curveMonotoneX); // Smooth curve

        const path = this.mainGroup.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 3)
            .attr("d", line);
            
        // Initial animation
        const totalLength = path.node().getTotalLength();
        path
            .attr("stroke-dasharray", totalLength + " " + totalLength)
            .attr("stroke-dashoffset", totalLength)
            .transition()
            .duration(2000)
            .ease(d3.easeCubicOut)
            .attr("stroke-dashoffset", 0);
            
        return path;
    }
}
