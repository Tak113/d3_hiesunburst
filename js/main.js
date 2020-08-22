// dimensions of sunburst
var width = 750;
var height = 600;
var radius = Math.min(width, height)/2;

//breadcumb dimensions: width, height, spacing, width of tip/tail
var b = {
  w: 75, h: 30, s: 3, t: 10
};

//mappiong of step names to colors
var colors = {
  "home": "#566573",
  "product": "#85929E",
  "search": "#70787C",
  "account": "#717D7E",
  "other": "#626567",
  "end": "#154360"
};

//total size of all segments; we set this later, after loading the data
var totalSize = 0;

//svg setting
var vis = d3.select("#chart").append("svg")
    .attr("width", width)
    .attr("height", height)
  .append("g")
    .attr("id", "container1")
    .attr("transform", "translate(" + width /2 + "," + height/2 + ")");

//partition function setting. loaded data to be fed to this function to be ready for hierarchical drawing
var partition = d3.partition()
    .size([2 * Math.PI, radius * radius]);

//arc setting for sunburst drawing
var arc = d3.arc()
    .startAngle(d=>{return d.x0; })
    .endAngle(d=>{return d.x1; })
    .innerRadius(d=>{return Math.sqrt(d.y0); })
    .outerRadius(d=>{return Math.sqrt(d.y1); });

//use d3.text and d3.csvParseRows so that we do not need to have a header row,
//and can receive the csv as an array of arrays (nested)
d3.text("data/visit-sequences.csv", function(text){
  var csv = d3.csvParseRows(text); //convert to json array looking at commma and rows
  var json = buildHierarchy(csv);
  createVisualization(json);
    console.log(text)
    console.log(csv)
    console.log(json)
});

//draw legend
function drawLegend() {

  //dimentions of legend item : width, height, spacing, radius of rounded rect
  var li = {w: 75, h: 30, s: 3, r: 3 };

  var legend = d3.select("#legend").append("svg")
    .attr("width", li.w)
    //d3.keys() returns the keys of the given object
    //this accesps single parameter object containing key and value in pairs
    .attr("height", d3.keys(colors).length * (li.h + li.s));

  var g = legend.selectAll("g")
    .data(d3.entries(colors))
    .enter().append("g")
      .attr("transform", (d,i)=>{return "translate(0," + i * (li.h + li.s) + ")"; })
    console.log(d3.entries(colors))

  g.append("rect")
    // .transition().duration(1000)
    .attr("rx", li.r)
    .attr("ry", li.r)
    .attr("width", li.w)
    .attr("height", li.h)
    .style("fill", d=>{return d.value; }); //array from d3.entries(colors)

  g.append("text")
    .attr("x", li.w/2)
    .attr("y", li.h/2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text(d=>{return d.key; }); //array from d3.entries(colors)

}

//switch on and off
function toggleLegend() {
  var legend = d3.select("#legend");
  if (legend.style("visibility") == "hidden") {
    legend.style("visibility", "");
  } else {
    legend.style("visibility", "hidden");
  }
}

//main function to draw and set up the sigualization, once we have the data
function createVisualization(json){

  //basic set up of page elements
  initializaBreadcrumbTrail();
  drawLegend();
  d3.select("#togglelegend").on("click", toggleLegend);

  //bounding circle underneath the sunburst, to make it easier to detect
  //when the mouse leaves the parent g
  vis.append("circle")
    .attr("r", radius)
    .style("opacity", 0);

  //turn the data into a d3 hierarchy and calculate the sums
  var root = d3.hierarchy(json)
    .sum(d=>{return d.size; })
    .sort((a,b)=>{return b.value - a.value; });
  console.log(root);

  //for efficiency, filter nodes to keep only those large enough to see
  var nodes = partition(root).descendants()
      .filter(d=>{
        return (d.x1 - d.x0 > 0.005); //0.005 radians = 0.29 degrees
      });
  console.log(nodes);

  //draw sunburst
  var path = vis.data([json]).selectAll("path")
    .data(nodes)
    .enter().append("path")
      .attr("display", d=>{return d.depth ? null : "none"; })
      .attr("d", arc)
      .attr("fill-rule", "evenodd")
      .style("fill", d=>{return colors[d.data.name]; })
      .style("opacity", 1)
      .on("mouseover", mouseover);

//add the mousleave handler to the bounding circle
d3.select("#container1").on("mouseleave",mouseleave);

//get total size of the tree = value of root node from partition
totalSize = path.datum().value;

};

//fade all but the current sequence, and show it in the breadcrumb trail
function mouseover(d) {

  var percentage = (100 * d.value / totalSize).toPrecision(2);
  var percentageString = percentage + "%";
  if (percentage < 0.1) {
    percentageString = "< 0.1%";
  }

  d3.select("#percentage")
    .text(percentageString);

  d3.select("#explanation")
    .style("visibility", "");

  var sequenceArray = d.ancestors().reverse();
  sequenceArray.shift(); //remove root node from the array
  updateBreadcrumbs(sequenceArray, percentageString);

  //fade all the segments
  d3.selectAll("path")
    .style("opacity", 0.3);

  //then highlight only those that are an ancestor of the current segemtn
  vis.selectAll("path")
    .filter(node=>{return (sequenceArray.indexOf(node) >= 0 ); })
    .style("opacity", 1);

}

//restore everything to full opacity when moving off the visualization
function mouseleave(d) {

  //hide the tbreadcrumb trail
  d3.select("#trail")
    .style("visibility", "hidden");

  //deactivate all segments during transition
  d3.selectAll("path").on("mouseover",null);

  //transition each segment to full opacity and tehn reactivate it
  d3.selectAll("path")
    .transition()
    .duration(1000)
    .style("opacity",1)
    .on("end", function(){d3.select(this).on("mouseover", mouseover); });

  d3.select("#explanation")
    .style("visibility", "hidden");

}

//take a 2-column CSV and transform it into a hierarchical structure suitable for a partition layout.
//the first column is a sequence of step names, from root to leaf, separated by hyphens.
//the second column is a count of how often that sequence occurred
//this is like a stratify function
function buildHierarchy(csv){
  var root = {"name": "root", "children": []}

  //i is repetitive steps for all data rows
  for (var i = 0; i < csv.length; i++) { //set i for all data repetition

    var sequence = csv[i][0]; //first column of data
    var size = csv[i][1]; //second column of data
    if (isNaN(size)) { continue; } //eg if this is a header row

    var parts = sequence.split("-"); //each event for each sequence
    var currentNode = root;

    //j is repetitive steps for each row sequences after splitting by hyphen("-")
    for (var j = 0; j < parts.length; j++) {
      var children = currentNode["children"];
      var nodeName = parts[j];
      var childNode;
        if (j + 1 < parts.length) { //if not yet at the end of the sequence; move down the tree
          var foundChild = false;
          for (var k = 0; k < children.length; k++) {
            if (children[k]["name"] == nodeName) {
              childNode = children[k];
              foundChild = true;
              break;
            }
          }
          //if we don't already have a child node for this branch, create it
          if (!foundChild) {
            childNode = {"name": nodeName, "children": []} //why children is brank?
            children.push(childNode);
          }
          currentNode = childNode;
        } else { //if at the end of the sequence; create a leaf node
          childNode = {"name": nodeName, "size": size };
          children.push(childNode); //add data to children
        }
    }

  }

  return root;
};

function initializaBreadcrumbTrail() {

  //add the svg area
  var trail = d3.select("#sequence").append("svg")
    .attr("width", width)
    .attr("height", 50)
    .attr("id", "trail");
  //add the lable at the end, for the percentage
  trail.append("text")
    .attr("id", "endlabel")
    .style("fill", "#000");
}

//generate a string that describes the points of a breadcrumb polygon
function breadcrumbPoints(d,i){
  var points = [];
  points.push("0,0");
  points.push(b.w + ",0");
  points.push(b.w + b.t + "," + (b.h /2));
  points.push(b.w + "," + b.h);
  points.push("0," + b.h);
  if (i>0){ //leftmost breadcrumb: 
    points.push(b.t + "," + (b.h /2));
  }
  return points.join(" ");
}

//update the breadcrumb trail to show the current sequence and percentage
function updateBreadcrumbs(nodeArray, percentageString){

  //data join; key function combines name and depth (= position in sequence)
  var trail = d3.select("#trail")
    .selectAll("g")
    .data(nodeArray, d=>{return d.data.name + d.depth; });

  //remove existing nodes
  trail.exit().remove();
  
  //add breadcrumb and label for eantering nodes
  var entering = trail.enter().append("g");

  entering.append("polygon")
    .attr("points", breadcrumbPoints)
    .style("fill", d=>{return colors[d.data.name]; });

  entering.append("text")
    .attr("x", (b.w + b.t) /2)
    .attr("y", b.h /2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text(d=>{return d.data.name; });

  //merge enter and update selections; set position for all nodes
  entering.merge(trail).attr("transform", (d,i)=>{
    return "translate(" + i * (b.w + b.s) + ",0)";
  })

  //now move and update the percentage at the end
  d3.select("#trail").select("#endlabel")
    .attr("x", (nodeArray.length + 0.5) * (b.w + b.s))
    .attr("y", b.h/2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text(percentageString);

  //make the breadcrumb trail visible, if it's hidden
  d3.select("#trail")
    .style("visibility", "");

}