console.log("OPENING A NEW TREE DOES NOT WORK :  ITS NOT EDITABLE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")

var app = angular.module('App', ['ngMaterial', 'ngMessages', 'ngAnimate', 'ngSanitize']);

var force, force_g, link_force, node_force;

app.config(function($httpProvider, $mdThemingProvider, $mdIconProvider, $mdDateLocaleProvider) {

  /******* Primary theme Firefly Orange *****/
  $mdThemingProvider.theme('default')
    .primaryPalette('deep-orange')//deep-orange
    .accentPalette('deep-orange');//indigo
  /****** Theme options *******/
  $mdThemingProvider.theme('dark-grey').backgroundPalette('grey').dark();
  $mdThemingProvider.theme('dark-orange').backgroundPalette('orange').dark();
  $mdThemingProvider.theme('dark-purple').backgroundPalette('deep-purple').dark();
  $mdThemingProvider.theme('dark-blue').backgroundPalette('blue').dark();
  /*********** Set the Icons *********/
  $mdIconProvider.icon('menu', 'imgs/icons/menu.svg', 24);
  $mdIconProvider.icon('form-view', 'imgs/icons/form_view.svg', 24);
  $mdIconProvider.icon('settings', 'imgs/icons/settings.svg', 24);
  $mdIconProvider.icon('add', 'imgs/icons/add.svg', 24);
  $mdIconProvider.icon('delete', 'imgs/icons/delete.svg', 24);
});

app.controller('main_ctrl', function($scope, $http, $mdDialog, $mdMedia, $mdSidenav,  $window){/* This one can deal with all the main page shit Nav and such */
  //$scope.image_list = ['tree','question', 'branch', 'leaf' ];
  $scope.image_list = [];
  $scope.this_tree_name = 'test_tree';

  var start_tree = 'firefly';
  var zoom_level = 3;

  
  var start_tree = 'device_tree';
  var zoom_level = 5;
  
  var zoomed = false;

  $scope.showing = false;

  var originatorEv;

  $scope.help = function(ev){       
    $mdDialog.show(
      $mdDialog.alert()
        .parent(angular.element(document.querySelector('body')))
        .clickOutsideToClose(true)
        .title('treebuilder.io help')
        .htmlContent('<div class="help">Tree builder allows you to build and navigate \n decision trees. You can also export the trees \n in json format.</div>')
        .ariaLabel('help')
        .ok('Got it!')
        .targetEvent(ev)
    );
  }

  $scope.openMenu = function($mdMenu, ev) {
      originatorEv = ev;
      $mdMenu.open(ev);
  };

  $scope.open = function(ev) {
    
    $http.post(server+"file_list", {
      data: {}
    }).then(function success(response) {
      console.log(response.data)
      $scope.file_list = response.data;
      $mdDialog.show({
          controller: open_file_ctrl,
          scope: $scope.$new(),
          templateUrl: 'dialogs/open_file.tmpl.html',
          parent: angular.element(document.body),
          clickOutsideToClose:true
        })
    })

    function open_file_ctrl(){

      $scope.cancelOpen = function(){
        $mdDialog.cancel();
      }

      $scope.open_file = function(file){
        $mdDialog.cancel();
        console.log("opening : "+file.name);
        getTree(file.name, false);
      }
    }

  };

  $scope.save = saveTree;

  function saveTree(ev, save_as){

    if($scope.this_tree_name===""){
      var confirm = $mdDialog.prompt()
        .title('Name your tree')
        //textContent('')
        .placeholder('Tree name')
        .ariaLabel('Tree name')
        .initialValue('Tree name')
        .targetEvent(ev)
        .required(true)
        .ok('Okay')
        .cancel('Cancel');

      $mdDialog.show(confirm).then(function(result) {
        $scope.this_tree_name = result ;
        saveTree(ev);
      }, function() {
        
      });
    }else{
      var savable_tree = [];
      // Convert to non-circular json
      for(var n in $scope.nodes){
        for(var i in $scope.nodes[n]){
          if(!savable_tree[n])savable_tree[n] = {};
          if(typeof $scope.nodes[n][i] === 'object'){
            if(i==='satelites')savable_tree[n][i] = $scope.nodes[n][i];
            else savable_tree[n][i] = $scope.nodes[n][i].name;
          }else savable_tree[n][i] = $scope.nodes[n][i];
        }
      }
      $http.post(server+"save_tree", {
        data: {name:$scope.this_tree_name, tree:savable_tree}
      }).then(function success(response) {

        $mdDialog.show(
          $mdDialog.alert()
            .parent(angular.element(document.querySelector('body')))
            .clickOutsideToClose(true)
            .title('Saved')
            .htmlContent('<div class="help">The tree has been saved.</div>')
            .ariaLabel('Tree Saved')
            .ok('OK')
            .targetEvent(ev)
        );
      })      
    }

  } 

  getImages();

  function getImages(){
    $http.post(server+"get_image_list", {
      data: {}
    }).then(function success(response) {
      var d = response.data;
      $scope.image_list = [];
      for(var i in d){
        $scope.image_list.push({title: makeTitle(d[i]), name:d[i]});
      }
    })
  }

  getTree(start_tree, false);//device_tree

  function getTree(name, use_base){
    console.log("get tree nodes : ")
         d3.selectAll(".text_box_div").html("");/******************************* testing *****/
    $http.post(server+"get_tree", {
      data: {name:name}
    }).then(function success(response) {
      console.log(response.data)
      if(response.data ==='Not found'|| use_base){ // use base creates a new file //
        // No saved tree so use the base tree //
        d3.json("data/base_tree.json", function(error, treeJSON) { // This can come from the server //
          if(!error){
            $scope.this_tree_name = name;
            console.log(treeJSON);
            //treeJSON = niceTree(treeJSON);// if loading the ppo use this and treeJSON[0] below //
            processTree(treeJSON[0]);
          }
          else console.log("Error getting base tree : "+error);
        });
      }else{

        // *********** Convert flat data into a nice tree ***************
        var data = response.data.tree;
        console.log(data);
        $scope.this_tree_name = name;
        var tree_data = niceTree(data);
        //console.log(tree_data)
        processTree(tree_data[0]);
      }
    })
  } 

  function niceTree(d){
    // create a name: node map
    var dataMap = d.reduce(function(map, node) {
      map[node.name] = node;
      return map;
    }, {});
    // create the tree array
    var tree_data = [];
    d.forEach(function(node) {
      // add to parent
      var parent = dataMap[node.parent];
      if (parent) {
        // create child array if it doesn't exist
        (parent.children || (parent.children = []))
          // add node to child array
          .push(node);
      } else {
        // parent is null or missing
        tree_data.push(node);
      }
    });
    return tree_data;
  }

  function download(){
     var savable_tree = [];
      // Convert to non-circular json
      for(var n in $scope.nodes){
        for(var i in $scope.nodes[n]){
          if(!savable_tree[n])savable_tree[n] = {};
          if(typeof $scope.nodes[n][i] === 'object'){
            if(i==='satelites')savable_tree[n][i] = $scope.nodes[n][i];
            else savable_tree[n][i] = $scope.nodes[n][i].name;
          }else savable_tree[n][i] = $scope.nodes[n][i];
        }
      }
      console.log("Saving : "+$scope.this_tree_name)
      console.log(savable_tree);

      downloadObjectAsJson(savable_tree, $scope.this_tree_name)
  }

  $scope.download = download;

  function downloadObjectAsJson(exportObj, exportName){
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  function editNode(node){
    console.log("EDITING NODE")
    
    $scope.node = node;
      $mdDialog.show({
          controller: editNodeController,
          scope: $scope.$new(),
          templateUrl: 'dialogs/edit_node.tmpl.html',
          parent: angular.element(document.body),
          clickOutsideToClose:true
        }).then(function(something) {
          console.log("Then");
        }, function(err) {
          console.log("err!!!")
          console.log(err);
        });

        function editNodeController(){
          
          getImages();

          $scope.submitNode= function(){
            console.log("submitNode!")
            console.log($scope.node)
            update($scope.node);
            $mdDialog.cancel();
          }

          $scope.cancelNode = function(){
            console.log("cancel dialog")
            $mdDialog.cancel();
          }

          $scope.deleteNode= function(){
            console.log("Delete Node "+node.name)
            $mdDialog.cancel();
            removeNode(node)
          }
          
          $scope.sateliteControl = function(){
            $mdDialog.cancel();
            editSatelites(node)
          }
        }
  }
  function editSatelites(node){
    console.log("edit satelites")

    $scope.node = node;

    $mdDialog.show({
        controller: editSatelitesController,
        scope: $scope.$new(),
        templateUrl: 'dialogs/edit_satelite.tmpl.html',
        parent: angular.element(document.body),
        clickOutsideToClose:true
      })
      .then(function(something) {
        console.log(something);
      }, function(err) {
        console.log(err);
      });

      function editSatelitesController(){

        $scope.submitNode= function(){
          update($scope.node);
          $mdDialog.cancel();
        }
        
        $scope.addSatelite = function(){

          if(!$scope.node.satelites)$scope.node.satelites = [];
          
          var baby_satelite = {
              id:generateUUID(),
              satelite:true,
              name: "S_"+$scope.node.satelites.length,
              image: "question.svg",
              text:"",
              x: Math.random()*width,
              y: Math.random()*height,
              parent:$scope.node.id
          }
          
          $scope.node.satelites.push(baby_satelite)
 
        }

        $scope.cancelSatelite = function(){
          $mdDialog.cancel();
        }

        $scope.deleteSatelite= function(i){
          console.log("Delete Node "+node.name)
          $scope.node.satelites.splice(i,1);
        }
        
      }
  }
    
    var windowWidth = document.getElementById('tree').clientWidth;;// $('#tree').width();//($('#tree').width()) > 400? $('#tree').width() : 400;
    var windowHeight = document.getElementById('tree').clientHeight;//$('#tree').height();
    var margin = {top: 20, right: 40, bottom: 20, left: 40}, width = windowWidth, height = 800 - margin.bottom;
    
    var showLabels = false;

    var tooltip = d3.select("body")
        .append("div")
        .attr("id","tooltip")
        .attr("class", "tooltip");

    var i = 0,
      duration = 750,
      root,
      s=windowWidth/44,
      aI=0;

    var r = windowWidth > 600 ? s-(s/6) : 20;//s-(s/6);

    var img_s = (r*1.3);
    //console.log("Image size : "+img_s);

    var text_width = 100;

    var tree = d3.layout.tree()
      .size([width, height]);

    var nodes;

    var diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.y, d.x]; });

    var svg = d3.select("#tree").append("svg")
      .attr("width", width)
      .attr("height", height + margin.top + margin.bottom)
      .call(d3.behavior.zoom().on("zoom", function () {
        pan_g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")")
      }))
        
    var pan_g = svg.append("g");
    
    var g = pan_g.append("g")
      .attr("id", "main_g")
      .attr("transform", function() {
        return d3.svg.transform()
          .translate( (width), margin.top+r+100)
          .rotate(90)();
      })

    var zoom = d3.behavior.zoom()
      .translate([0, 0])
      .scale(1)
      .scaleExtent([1, 8])
      .on("zoom", zoomed);
    
    function zoomed() {
      g.attr("transform", "translate(" + d3.event.translate + ")rotate(90)scale(" + d3.event.scale + ")");
    }

    $scope.newTree = function(ev){
      $scope.nodes=[];
      nodes = null;
      root=null;
      getTree("", true);
    }
    $scope.show = function(ev){
      console.log("zoomed: "+zoomed);

      if(!zoomed){
        zoomed=true;
        $scope.showing = true;
        svg.attr("transform", "translate(0,0)" + " scale(1)")
        d3.selectAll(".unzoomed").style("visibility", "hidden");
        d3.selectAll(".zoomed").style("visibility", "visible");
        focusOn(root.name);
      }else{
        zoomed=false;
        $scope.showing = false;
        d3.selectAll(".unzoomed").style("visibility", "visible");
        d3.selectAll(".zoomed").style("visibility", "hidden");
        focusOn("zoom_out");
        if(force_g)force_g.remove();
      }
    }

    function focusOn(target){
      console.log("focus on "+target)

      zoom_out = {x:width/2}
      var focus_node, scale, translate;
      //console.log(d3.transform(d3.select("#Tree").attr('transform')))
      if(target==='zoom_out'){
        var x = width / 2;
        var y = (height / 2) - 300;
        scale = 1;
        translate = [width / 2 - scale * -x , height / 2 - scale * y];

      }else{
        focus_node = nodes.filter(function(n){return n.name === target})[0];
        if(!focus_node)console.log("We need to expand this node")
        var x = focus_node.x;
        var y = focus_node.y;
        scale = zoom_level;
        translate = [width / 2 - scale * -x, height / 2 - scale * y];

        setTimeout(function(){ showSatelite(focus_node); }, 1000);
        
      }

      if(translate && scale){
        g.transition()
          .duration(1000)
          .attr("transform", "translate(" + translate + ")rotate(90)scale(" + scale + ")");
      }else{
          console.log("Target "+target+" not found.")
          console.log(nodes);
      }
      update(root)
    }
    $scope.focusOn = focusOn;

    function expand(d) {
      if (d._children) {
        d.children = d._children;
        d.children.forEach(expand);
        d._children = null;
      }
    }
    function expandAll(){
      root.children.forEach(expand);
      update(root);
    }

    function getCurvePath(size_relative_to_r) {
      //Creating an Arc path
      var this_r = r * size_relative_to_r;//1.05
      var start_x =  -this_r;
      var start_y =  0;
      var end_x =  this_r;
      var end_y =  0;
      //      M   start-x,         start-y          A radius-x,       radius-y,    x-axis-rotation, large-arc-flag, sweep-flag, end-x, end-y
      return 'M' + start_x + ',' + start_y + ' ' + 'A' + this_r + ',' + this_r + ' 0 0 1 ' + end_x + ','+ end_y;
    }

    var straightenTheCurve = "M-300,250 A80,80 0 0,1 300,250";//"M-300,254 A10,10 0 0,1 300,254";//

    var radialGradient = svg.append("defs")
      .append("radialGradient")
        .attr("id", "radial-gradient");

    radialGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#ed5109");// blue : "#0066cc"

    radialGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#3a3b3d");// blue  "#3a3b3d"  

    function processTree(treeJSON){
      root = treeJSON;
      root.x0 = (width / 2);
      root.y0 = 0;

      function expand(d) {
        if (d._children) {
          d.children = d._children;
          d.children.forEach(expand);
          d._children = null;
        }
      }

      function collapse(d) {
        if (d.children) {
          d._children = d.children;
          d._children.forEach(collapse);
          d.children = null;
        }
      }

      //console.log(root);
      //root.children.forEach(collapse);
      if(root.children)root.children.forEach(expand);

      update(root);
    }

    function removeNode(d)
    {
      //this is the links target node which you want to remove
      console.log(d)
      //make new set of children
      var children = [];
      //iterate through the children 
      d.parent.children.forEach(function(child){
       if (child.id != d.id){
         //add to the child list if target id is not same 
         //so that the node target is removed.
         children.push(child);
       }
      });
      //set the target parent with new set of children sans the one which is removed
      d.parent.children = children;
      //redraw the parent since one of its children is removed
      update(d.parent)
    }

    function update(source) {

      // Compute the new tree layout.
      nodes = tree.nodes(root).reverse(),
      links = tree.links(nodes);

      // Normalize for fixed-depth.
      var branch_length;
      if(zoomed)branch_length = 4;
      else branch_length = 8;
      //console.log("branch length : "+branch_length)
      nodes.forEach(function(d) { d.y = d.depth * height/branch_length; });// This controls the width of the links

      // Update the nodes…
      var node = g.selectAll("g.node")
        .data(nodes, function(d) { return d.id || (d.id = ++i); });

      // Enter any new nodes at the parent's previous position.
      var nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .attr("id", function(d){if(d.name)return d.name.replaceAll(' ','_');})
        .style('pointer-events', 'all')
        .attr("transform", function() {
          return d3.svg.transform()
          .translate( source.y0, source.x0 )();
        })
        .on("mouseenter", function(d){
          if(!zoomed){
            var this_node = d3.select(this);
            this_node.selectAll(".control_button").style("visibility", "visible");
            this_node.selectAll(".q_a").style("visibility", "visible");
            // Pulse //
            this_node.select(".pulse").transition().duration(500)
              .attr("r", r+25)
              .each("end", function(){            
                this_node.select(".pulse").transition().duration(500)
                .attr("r", r);
              })
          }
        })
        .on("mouseleave", function(d){
          if(!zoomed)d3.select(this).selectAll(".control_button").style("visibility", "hidden");
        })

      nodeEnter.append("circle")
        .attr("class", "pulse")
        .attr("r", r)
        .style("opacity", .6)
        .style("fill", "url(#radial-gradient)");

      nodeEnter.append("path")
        .attr("id", function(d){if(d.name)return 'text_path_'+d.name.replaceAll(' ','_')})//'#text_path_'+d.name.replace(' ','_')
        .attr("d", function(d){return getCurvePath(1.05)})
        .attr("fill", "none")
        .attr("transform", "rotate(-90)");

      // add our text with embedded textPath and link the latter to the defined #curvedTextPath
      nodeEnter.append('text')
        .append('textPath')
        .attr("class", "curvedText")
        .attr('startOffset', '50%')
        .attr('xlink:href', function(d){if(d.name)return '#text_path_'+d.name.replaceAll(' ','_')})//was : .attr('xlink:href', '#curvedTextPath')
        .text(function(d){return d.name});

      nodeEnter.append("rect")
        .attr("class", "node_background main click_node")
        .attr("x", -r)
        .attr("y", -r)
        .attr("width", r*2)
        .attr("height", r*2)
        .attr("rx", r)
        .attr("ry", r)
        .style("fill", "#fff")

      nodeEnter.append("svg:image")
        .attr("class", "image click_node")
        .style("visibility", "visible")
        .attr("xlink:href", function(d){ 
          if(d.image) return "images/tree/"+d.image
          else return null;
        })
        .attr("x", -img_s/2)      
        .attr("y", -img_s/2)
        .attr("width", (img_s))
        .attr("height", (img_s))
        .attr("transform", "rotate(-90)")


      nodeEnter.append("svg:image")
        .attr("id", "add_node")
        .attr("class", "control_button")
        .style("visibility", "hidden")
        .attr("xlink:href", function(d){return "images/add.svg"; })
        .attr("x", -s)     
        .attr("y", s-(s/3))
        .attr("width", s/1.8)
        .attr("height", s/1.8)
        .attr("transform", "rotate(-90)")
        .on("click", function(d){
          if(!zoomed)addChild(d);
        })

      nodeEnter.append("svg:image")
        .attr("id", "expand")
        .attr("class", "control_button")
        .style("visibility", "hidden")
        .attr("xlink:href", function(d){
          var img = d.children ? "contract" : "expand";
          if(!d.children && !d._children)img = "none";
          return "images/"+img+".svg"; })
        .attr("x", s-(s/3))           
        .attr("y", s-(s/3))
        .attr("width", s/1.8)
        .attr("height", s/1.8)
        .attr("transform", "rotate(-90)")
        .on("click", function(d){
          if(!zoomed)showChildren(d);
        })

       nodeEnter.append('foreignObject')
        .attr("class", "main_text")
        .style("visibility", "hidden")
        .style("opacity", 0)
        .attr("x", -(text_width/2))           
        .attr("y", -(s*.5))
        .attr("width", text_width)
        .attr("height", 20)
        .attr("transform", "rotate(-90)")
        .append('xhtml:div')
        .html(function(d){
          if(d.question)return `<div class='z_q_a'>`+d.question+`</div>`;
        })

      nodeEnter.append('foreignObject')
        .attr("class", "text_box zoomed")
        .style("visibility", "hidden")
        .attr("x", -(text_width/2))           
        .attr("y", s + 5)
        .attr("width", text_width)
        .attr("height", 20)
        .attr("transform", "rotate(-90)")
        .append('xhtml:div')
        .attr("class", "text_box_div")
        .html(function(d){
          //console.log(d)
          var html;
          var children = d.children || d._children;
          // was below after column : <div class='z_q_a zoomed'>`+d.question+`</div> //
          //if(d.question){
          html= `
              <div layout='column'>
              <div flex='100' layout='row' layout-align="center center" >`;
              if(children){
                var flex = 100 / children.length;
                for(var c = children.length - 1; c>-1; c--){
                  if(children[c].answer === 'OK')children[c].answer = "<img src='images/down.svg'/>"
                  console.log(d.name+ " => " + c + " : " +children[c].answer)
                  html+=`<div class='answer_button zoomed' style="width:`+flex+`%; display:inline-flex" answer_link="`+children[c].name+`">
                          <span>`+children[c].answer+`</span>
                         </div>`
                }
              }
            html+=`</div></div>`;
          //}
          return html;
        })

        d3.selectAll(".click_node")
          .on("click", function(d){
            if(!zoomed)editNode(d);
            else{
              showInfo(d.name.replaceAll(' ','_'))
              setTimeout(function(){hideInfo(d.name.replaceAll(' ','_'))}, 3000);   
            }
          })

        d3.selectAll(".answer_button")
          .on("click", function(){
            focusOn(d3.select(this).attr('answer_link'));// sends the name of the node containing the answerr to the focus function
          })
        // Transition nodes to their new position.
        var nodeUpdate = node.transition()
          .duration(duration)
          .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

        nodeUpdate.select(".node_background")
          .attr("r", r)
          .style("fill", "#fff");

        nodeUpdate.select(".image")
          .attr("xlink:href", function(d){ 
            if(d.image)return "images/tree/"+d.image; 
            else return null;
          })

        nodeUpdate.select("#expand")
          .attr("xlink:href", function(d){
            var img = d.children ? "contract" : "expand";
            if(!d.children && !d._children)img ="none";
            return "images/"+img+".svg";
          })

        nodeUpdate.selectAll("text")
          .style("fill-opacity", 1);

        nodeUpdate.selectAll(".curvedText")
          .text(function(d){return d.name});

        nodeUpdate.select("#show_satelite")
          .style("visibility", function(d){return d.satelites ? "visible" : "hidden";})

        nodeUpdate.select(".text_box")
          .style("fill-opacity", 1);

        function buildHTMLButtons(d){
          var html;
          var children = d.children || d._children;
          html= `
              <div layout='column'>
              <div flex='100' layout='row' layout-align="center center" >`;
              if(children){
                var flex = 100 / children.length;
                for(var c = children.length - 1; c>-1; c--){
                  console.log("UPDATE DIV "+children[c].answer)
                  if(children[c].answer === 'OK')children[c].answer = "<img src='images/down.svg'/>"
                  html+=`<div class='answer_button zoomed' style="width:`+flex+`%; display:inline-flex" answer_link="`+children[c].name+`">
                          <span>`+children[c].answer+`</span>
                         </div>`
                }
              }
            html+=`</div></div>`;
            return html;
        }
        // Transition exiting nodes to the parent's new position.
        var nodeExit = node.exit().transition()
          .duration(duration)
          .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
          .remove();

        nodeExit.select("circle")
            .attr("r", 1e-6);

        nodeExit.select("text")
            .style("fill-opacity", 1e-6);

        nodeExit.selectAll("foreignObject").remove();

        // Update the links…
        var link = g.selectAll("path.link")
            .data(links, function(d) { return d.target.id; });

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
          .attr("class", "link")
          .attr("d", function(d) {
            var o = {x: source.x0, y: source.y0};
            return diagonal({source: o, target: o});
          });

        // Transition links to their new position.
        link.transition()
          .duration(duration)
          .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
          .duration(duration)
          .attr("d", function(d) {
            var o = {x: source.x, y: source.y};
            return diagonal({source: o, target: o});
          })
          .remove();

        // Stash the old positions for transition.
        nodes.forEach(function(d) {
          //d.y = d.depth * 180; 
          d.x0 = d.x;
          d.y0 = d.y;
        });

        $scope.nodes = nodes;
    }

    function showInfo(this_name){
      d3.select('#'+this_name).select(".main")
        .transition()
        .duration(1000)
        .attr("height", r*3)
        .attr("y", (-r*1.5))
        .attr("rx",0)
        .attr("ry",0);

      d3.select('#'+this_name).select(".main_text")
        .style("visibility", "visible")
        .transition().duration(1000)
        .style("opacity", 1);
      
      d3.select('#'+this_name).select(".image")
        .transition().duration(1000)
        .style("opacity", 0)
        .each("end", function(){d3.select(this).style("visibility", "hidden")})

      d3.selectAll('#text_path_'+this_name)
        .transition().duration(2000)
        .attr("d", function(d){return straightenTheCurve});
    }

    function hideInfo(this_name){
      d3.select('#'+this_name).select(".main")
        .transition()
        .duration(1000)
        .attr("height", r*2)
        .attr("y", (-r))
        .attr("rx",r)
        .attr("ry",r);

      d3.select('#'+this_name).select(".main_text")
        .transition().duration(1000)
        .style("opacity", 0)
        .each("end", function(){d3.select(this).style("visibility", "hidden")})

      d3.select('#'+this_name).select("image")
        .style("visibility", "visible")
        .transition().duration(1000)
        .style("opacity", 1);

      d3.selectAll('#text_path_'+this_name)
        .transition().duration(2000)
        .attr("d", function(d){return getCurvePath(1.05)});
    }

    function showSateliteInfo(this_name){
      console.log("SHOW satelite info "+this_name);
      
      d3.select('#'+this_name).select(".node_background ")
        .transition().duration(1000)
        .attr("y", function(d){return -d.r*2;})
        .attr("height",  function(d){return (d.r*4);})
        .attr("rx", 0)
        .attr("ry", 0);

      d3.select('#'+this_name).select(".text_box")
        .transition().duration(1000)
        .style("opacity", 1);

      d3.select('#'+this_name).select(".image")
        .transition().duration(1000)
        .style("opacity", 0);      

        d3.selectAll('#satelite_text_path_'+this_name)//'satelite_text_path_'+d.name.replaceAll(' ','_')
        .transition().duration(2000)
        .attr("d", function(d){return straightenTheCurve;});//getCurvePath(1.05)

    }

    function hideSateliteInfo(this_name){

      d3.select('#'+this_name).select(".node_background ")
        .transition().duration(1000)
        .attr("y", function(d){return -d.r;})
        .attr("height",  function(d){return (d.r*2);})
        .attr("rx", function(d){return (d.r);})
        .attr("ry", function(d){return (d.r);})

      d3.select('#'+this_name).select(".text_box")
        .transition().duration(1000)
        .style("opacity", 0);

      d3.select('#'+this_name).select(".image")
        .transition().duration(1000)
        .style("opacity", 1);

    }

    function addChild(d){
      console.log("add Child")
      console.log(d)
      console.log(d.name)
      // first expand any existing children
      if(d._children){
        d.children = d._children;
        d._children = null;
      }
      // If no children array creete it
      if(!d.children)d.children = [];
      var baby = {
        id:generateUUID(),
        name: d.name+"-child_"+d.children.length,
        image: "question.svg",
        question:"",
        answer:"",
        parent:d
      }
      //console.log(baby);
      d.children.push(baby); // push the baby
      update(d); // Show the changesS
    }
    // Toggle children on click.
    function showChildren(d) {

      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      update(d);
    }

  function showSatelite(p){

    var satelites = {};
        satelites.nodes = [];
        satelites.links = [];

    var node_r = r*.5;
    
    if(p.satelites){
      satelites.nodes.push({id:'force_root', name:"", fixed:true, x:0, y:0, r:0});
      var positions = pointsOnCircle(p.satelites.length, r+30)

      i=1; //0 is force_root
      for(var s in p.satelites){
        p.satelites[s].x = positions[s].x, p.satelites[s].y = positions[s].y;
        p.satelites[s].r = node_r;
        satelites.nodes.push(p.satelites[s]);
        satelites.links.push({source:0, target:i});
        i++;
      }     

    }
    
    if(force_g)force_g.remove();

    force = d3.layout.force()
      .nodes(satelites.nodes)
      .links(satelites.links)
      .size([width, height])
      .charge(-300)//if(d.id === 'force_root')return -3000; else return -3000
      .gravity(0)
      .linkDistance(node_r*5)
      .friction(.1)
      .on("tick", tick)
      .start();
    
    if(p.name)d3.select("#"+p.name.replaceAll(' ','_')).moveToFront();

    force_g = d3.select("#"+p.name.replaceAll(' ','_'))
      .append("g")
      .attr("class", "force_g");

    link_force = force_g.selectAll(".force_link")
      .data(satelites.links)
      .enter().append("line")
      .attr("class", "force_link")
      .attr("visibility", "hidden")
      .on("click", function(){"Force link clicked!"});

    node_force = force_g.selectAll(".force_node")
        .data(satelites.nodes)
        .enter()
        .append("g")
        .attr("class", "force_node")
        .attr("id", function(d){
          if(!d.name)return "base_force_node";
          else return "satelite_"+d.name.replaceAll(' ','_');
        })
        .on("click", function(d){
          console.log("A satelite was clicked !")
          if(d.name){
            showSateliteInfo("satelite_"+d.name.replaceAll(' ','_'))
            setTimeout(function(){
              hideSateliteInfo("satelite_"+d.name.replaceAll(' ','_'));
            },3000);            
          }

        })

    node_force.append("path")
        .attr("id", function(d){return 'satelite_text_path_'+d.name.replaceAll(' ','_')})//'#text_path_'+d.name.replace(' ','_')
        .attr("d", function(d){return getCurvePath(0.55)})
        .attr("fill", "none")
        .attr("transform", "rotate(-90)");

    // add our text with embedded textPath and link the latter to the defined #curvedTextPath
    node_force.append('text')
        .append('textPath')
        .attr("class", "curvedTextSatelite")
        .attr('startOffset', '50%')
        .attr('xlink:href', function(d){return '#satelite_text_path_'+d.name.replaceAll(' ','_')})
        .text(function(d){return d.name});

    // add our text with embedded textPath and link the latter to the defined #curvedTextPath
    node_force.append("rect")  
        .attr("class", "node_background main")
        .attr("x", function(d){return -d.r;})
        .attr("y", function(d){return -d.r;})
        .attr("width",  function(d){return (d.r*2);})
        .attr("height", function(d){return (d.r*2);})
        .attr("rx", node_r)
        .attr("ry", node_r)
        .style("fill", "#fff")

    node_force.append("svg:image")
        .attr("class", "image")
        .style("opacity", 1)
        .attr("xlink:href", function(d){      
          if(d.image) return "images/tree/"+d.image
          else return null;
        })
        .attr("x", -(node_r/2))
        .attr("y", -(node_r/2))
        .attr("width", node_r)
        .attr("height", node_r)
        .attr("transform", "rotate(-90)")

    node_force.append('foreignObject')
        .attr("class", "text_box")
        .style("opacity", 0)
        .attr("x", -(text_width/4))           
        .attr("y", node_r - 10)
        .attr("width", (text_width/2))
        .attr("height", 20)
        .attr("transform", "rotate(-90)")
        .append('xhtml:div')
        .html(function(d){
          if(d.text){
            var html ="<div class='satelite_text'>"+d.text+"</div>";
            return html;
          }
        });

    function tick() {
      link_force.attr("x1", function(d) { return d.source.x; })
          .attr("y1", function(d) { return d.source.y; })
          .attr("x2", function(d) { return d.target.x; })
          .attr("y2", function(d) { return d.target.y; });

              //Moving <g> elements using transform attribute
      node_force.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
    //node_force.attr("cx", function(d) { return d.x; })
    //      .attr("cy", function(d) { return d.y; });
    }
  }

  function showTooltip(d){
    var text = d.tooltip;

    if(d.offset){var tooltip_offset_y = -70}
    else var tooltip_offset_y = 20;

    var tooltip_offset_x = -(text.length*3.9);//(d3.event.pageX < ($('body').width()/2)) ? 50 : -150;
    
    var x = d3.event.pageX + tooltip_offset_x, y = d3.event.pageY + tooltip_offset_y;

    d3.select("#tooltip")
        .style("visibility","visible")
        .style("left",x + "px")
        .style("top", y + "px")
        .html(text);
  }

});

app.filter('capitalize', function() {
    return function(input) {
      return (!!input) ? input.charAt(0).toUpperCase() + input.substr(1).toLowerCase() : '';
    }
});

app.filter('firstLetter', function() {
    return function(input) {
      return input.charAt(0).toUpperCase();
    }
});

app.filter('orderObjectBy', function(){// Filter an object by an attribute (used for ordering a list after a search (specifically in the acocunts page))
   return function(input, attribute) {
      if (!angular.isObject(input)) return input;

      var array = [];
      for(var objectKey in input) {
          array.push(input[objectKey]);
      }

      array.sort(function(a, b){
          a = parseInt(a[attribute]);
          b = parseInt(b[attribute]);
          return a - b;
      });
      return array;
   }
});

d3.selection.prototype.moveToFront = function() {  
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

function generateUUID(){
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
};

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}
String.prototype.replaceAll = function(target, replacement) {
  return this.split(target).join(replacement);
};

function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function makeTitle(d){
  d = capitalize(d);
  return d.split('.')[0].replace('_', ' ');
}
function pointsOnCircle(amount, this_r){
  var points = [];
  for(var i = 0; i < amount; i++) {
    var x =  this_r * Math.cos(2 * Math.PI * i / amount);
    var y =  this_r * Math.sin(2 * Math.PI * i / amount);
    points.push({x:x.toFixed(2),y:y.toFixed(2)});
  }
  return points;
}