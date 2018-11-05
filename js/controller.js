let app = angular.module('App', ['ngMaterial', 'ngMessages', 'ngAnimate', 'ngSanitize']);

let force, force_g, link_force, node_force;

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

app.controller('main_ctrl', function($scope, $http, $mdDialog, $mdMedia, $mdSidenav,  $window, $q){/* This one can deal with all the main page shit Nav and such */

  $scope.username = "test_user";
  $scope.image_list = [];
  $scope.this_tree_name = 'test_tree';
  $scope.showing = false;

  let start_tree = 'test_tree';
  let zoom_level = 3;
  let zoomed = false;
  let originatorEv;
  let pan_zoom = {translate:[0,0],scale:[0,0]};

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

    if($scope.this_tree_name===""||save_as){
      let confirm = $mdDialog.prompt()
        .title('Name your tree')
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
      let savable_tree = [];
      // Convert to non-circular json
      for(let n in $scope.nodes){

        if($scope.nodes[n].id ===1){
          
          $scope.nodes[n].id = generateUUID();

        }else{
          //console.log("not getting new guid: "+$scope.nodes[n].id)
        }
        for(let i in $scope.nodes[n]){
          if(!savable_tree[n])savable_tree[n] = {};
          if(typeof $scope.nodes[n][i] === 'object'){
            if(i==='satelites')savable_tree[n][i] = $scope.nodes[n][i];
            else savable_tree[n][i] = $scope.nodes[n][i].name;
          }else savable_tree[n][i] = $scope.nodes[n][i];
        }
      }
      $http.post(server+"save_tree", {
        data: {name:$scope.this_tree_name, user:$scope.username, tree:savable_tree}
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
        var temp = [];
        for(var i in d){
          temp.push({title: makeTitle(d[i]), name:d[i]});
        }
        $scope.image_list = temp;
      })
  }

  getTree(start_tree, false);

  function getTree(name, use_base){
    // Empty the div //
    d3.selectAll(".text_box_div").html("");

    $http.post(server+"get_tree", {
      data: {name:name}
    }).then(function success(response) {

      if(response.data ==='Not found'|| use_base){ // use base creates a new file //
        // No saved tree so use the base tree //
        d3.json("data/firefly_3.json", function(error, treeJSON) { // This loads an example tree
          if(!error){
            $scope.this_tree_name = "new_tree";
            let tree_data = niceTree(treeJSON);
            processTree(tree_data[0]);

          }
          else console.log("Error getting base tree : "+error);
        });
      }else{

        // *********** Convert flat data into a nice tree ***************
        let data = response.data.tree;
        console.log(data);
        $scope.this_tree_name = name;
        let tree_data = niceTree(data);
        processTree(tree_data[0]);
      }
    });
  } 

  function niceTree(d){
    // create a name: node map
    let dataMap = d.reduce(function(map, node) {
      map[node.name] = node;
      return map;
    }, {});
    // create the tree array
    let tree_data = [];
    let j = 1;
    d.forEach(function(node) {
      // Adding some admin shit //
      node.node_type = 'text';
      node.id = "node_"+j;
      j++;
      // add to parent
      let parent = dataMap[node.parent];
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
     let savable_tree = [];
      // Convert to non-circular json
      for(let n in $scope.nodes){
        for(let i in $scope.nodes[n]){
          if(!savable_tree[n])savable_tree[n] = {};
          if(typeof $scope.nodes[n][i] === 'object'){
            if(i==='satelites')savable_tree[n][i] = $scope.nodes[n][i];
            else savable_tree[n][i] = $scope.nodes[n][i].name;
          }else savable_tree[n][i] = $scope.nodes[n][i];
        }
      }
      downloadObjectAsJson(savable_tree, $scope.this_tree_name)
  }

  $scope.download = download;

  function downloadObjectAsJson(exportObj, exportName){
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
    let downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  function editNode(node){
    
    $scope.node = node;
      $mdDialog.show({
          controller: editNodeController,
          scope: $scope.$new(),
          templateUrl: 'dialogs/edit_node.tmpl.html',
          parent: angular.element(document.body),
          clickOutsideToClose:true
        }).then(function(){
          getImages();
        })

        function editNodeController(){

          $scope.submitNode= function(){
            update($scope.node);
            $mdDialog.cancel();
          }

          $scope.cancelNode = function(){
            $mdDialog.cancel();
          }

          $scope.deleteNode= function(){
            $mdDialog.cancel();
            removeNode(node)
          }

          $scope.viewNode = function(){
            $mdDialog.cancel();
            zoomed=true;
            $scope.showing = true;
            d3.selectAll(".unzoomed").style("visibility", "hidden");
            d3.selectAll(".zoomed").style("visibility", "visible");
            focusOn($scope.node.name);
          }
          
          $scope.sateliteControl = function(){
            $mdDialog.cancel();
            editSatelites(node)
          }

          $scope.addSatelite = function(){

            if(!$scope.node.satelites)$scope.node.satelites = [];
            let baby_satelite = {
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

          $scope.deleteSatelite= function(sat_i){
            $scope.node.satelites.splice(sat_i,1);
          }
        }
  }
    
    let windowWidth = document.getElementById('tree').clientWidth;;
    let windowHeight = document.getElementById('tree').clientHeight;
    
    let margin = {top: 20, right: 40, bottom: 20, left: 40}, width = windowWidth, height = 800 - margin.bottom;
    
    let showLabels = false;

    let i = 0,
      duration = 750,
      root,
      s=windowWidth/44,
      aI=0;

    let r = windowWidth > 600 ? s-(s/6) : 20;//s-(s/6);

    let img_s = (r*1.3);

    let text_width = 100;

    let tree = d3.layout.tree()
      .size([width, height]);

    let nodes;

    let diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.y, d.x]; });

    let zoom = d3.behavior.zoom()
      .scale(1)
      .scaleExtent([1, 5])
      .on("zoom", zoomed_func);

    function zoomed_func() {
      var translateX = d3.event.translate[0];
      var translateY = d3.event.translate[1];
      var xScale = d3.event.scale;
      pan_g.attr("transform", "translate(" + d3.event.translate[0] + "," + d3.event.translate[1] + ")scale(" + d3.event.scale + ")");
    }

    let svg = d3.select("#tree").append("svg")
      .attr("width", width)
      .attr("height", height + margin.top + margin.bottom)
      .call(zoom)
        
    let pan_g = svg.append("g")
 
    let g = pan_g.append("g")
      .attr("id", "main_g")
      .attr("transform", function() {
        return d3.svg.transform()
          .translate( (width), margin.top+r+100)
          .rotate(90)();
      })

    $scope.newTree = function(ev){
      $scope.nodes=[];
      nodes = null;
      root=null;
      getTree("", true);
    }

    $scope.show = function(ev){
      if(!zoomed){
        zoomed=true;
        $scope.showing = true;

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

      zoom_out = {x:width/2};
      let focus_node, scale, translate;
      // Find the current g translate
      let t = d3.transform(pan_g.attr("transform")).translate;
      
      if(target==='zoom_out'){
        let x = width / 2;
        let y = (height / 2) - 300;
        scale = 1;
        translate = [ (width / 2 - scale * -x) - t[0], (height / 2 - scale * y) - t[1]];
      }else{
        focus_node = nodes.filter(function(n){return n.name === target})[0];
        if(!focus_node)console.log(target+" not found! Therefore we can't focus.");
        else{
          let x = focus_node.x;
          let y = focus_node.y;
          scale = zoom_level;
          translate = [ (width / 2 - scale * -x) - t[0], (height / 2 - scale * y) - t[1]];
          setTimeout(function(){ showSatelite(focus_node); }, 1000);          
        }  
      }

      if(translate && scale){
        g.transition()
          .duration(1000)
          .attr("transform", "translate(" + translate + ")rotate(90)scale(" + scale + ")");

      }else{
          console.log("Target "+target+" not found.")
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

    function getCurvePath(size_relative_to_r) {
      // Creating an Arc path
      let this_r = r * size_relative_to_r;//1.05
      let start_x =  -this_r;
      let start_y =  0;
      let end_x =  this_r;
      let end_y =  0;
      // return svg path
      return 'M' + start_x + ',' + start_y + ' ' + 'A' + this_r + ',' + this_r + ' 0 0 1 ' + end_x + ','+ end_y;
    }


    let radial_gradient = svg.append("defs")
        .append("radialGradient")
        .attr("id", "radial-gradient");

    radial_gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#ed5109");

    radial_gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#3a3b3d");

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

      if(root.children)root.children.forEach(expand);

      update(root);
    }

    function removeNode(d)
    {
      //this is the links target node which you want to remove
      //console.log(d)
      //make new set of children
      let children = [];
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
      //console.log("Source : "+$scope.this_tree_name);
      //console.log(source)
      // Compute the new tree layout.
      nodes = tree.nodes(root);//.reverse(),
      links = tree.links(nodes);

      // Normalize for fixed-depth.
      let branch_length;
      if(zoomed)branch_length = 4;// when zoomed the distance between nodes is longer //
      else branch_length = 8;
      //console.log("branch length : "+branch_length)
      nodes.forEach(function(d) { d.y = d.depth * height/branch_length; });// This controls the width of the links

      // Update the nodes…
      let node = g.selectAll("g.node")
        .data(nodes, function(d) { return d.id || generateUUID(); });
        //.data(nodes, function(d) { return d.id || (d.id = ++i); });

      // Enter any new nodes at the parent's previous position.
      let nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .attr("id", function(d){return d.id })//if(d.name)return d.name.replaceAll(' ','_');})
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
        .attr("id", function(d){if(d.id)return 'text_path_'+d.id})
        .attr("d", function(d){return getCurvePath(1.05)})
        .attr("fill", "none")
        .attr("transform", "rotate(-90)");

      nodeEnter.append("rect")
        .attr("class", "node_background main click_node")
        .attr("x", -r)
        .attr("y", -r)
        .attr("width", r*2)
        .attr("height", r*2)
        .attr("rx", r)
        .attr("ry", r)
        .style("fill", "#fff")

      // add our text with embedded textPath and link the latter to the defined #curvedTextPath
      nodeEnter.append('text')
        .append('textPath')
        .attr("class", "curvedText")
        .attr('startOffset', '50%')
        .attr('xlink:href', function(d){if(d.name)return '#text_path_'+d.id})//was : .attr('xlink:href', '#curvedTextPath')
        .text(function(d){return d.name});

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
        .attr("class", "text_box zoomed")
        .style("visibility", "hidden")
        .attr("x", -(text_width/2))           
        .attr("y", s + 5)
        .attr("width", text_width)
        .attr("height", 20)
        .attr("transform", "rotate(-90)")
        .append('xhtml:div')
        .attr("class", "text_box_div")
        .html(function(d,i){
          let html;
          let children = d.children || d._children;
          html= `
              <div layout='column'>
              <div flex='100' layout='row' layout-align="center center" >`;
              if(children){
                let flex = 100 / children.length;
                for(var c = children.length - 1; c>-1; c--){
                  if(children[c].answer === 'OK')children[c].answer = "<img src='images/down.svg'/>"
                  //console.log(d.name+ " => " + c + " : " +children[c].answer)
                  html+=`<div class='answer_button zoomed' style="width:`+flex+`%; display:inline-flex" answer_link="`+d.id+`">
                          <span>`+children[c].answer+`</span>
                         </div>`;
                }
              }
            html+=`</div></div>`;
          return html;
        })

        d3.selectAll(".click_node")
          .on("click", function(d){
            if(!zoomed)editNode(d);
            else{
              showDialogInfo(d, d3.event)
            }
          })

        d3.selectAll(".answer_button")
          .on("click", function(){
            focusOn(d3.select(this).attr('answer_link'));// sends the name of the node containing the answerr to the focus function
          })
        // Transition nodes to their new position.
        let nodeUpdate = node.transition()
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
            let img = d.children ? "contract" : "expand";
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

        // Transition exiting nodes to the parent's new position.
        let nodeExit = node.exit().transition()
          .duration(duration)
          .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
          .remove();

        nodeExit.select("circle")
            .attr("r", 1e-6);

        nodeExit.select("text")
            .style("fill-opacity", 1e-6);

        nodeExit.selectAll("foreignObject").remove();

        // Update the links…
        let link = g.selectAll("path.link")
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
            let o = {x: source.x, y: source.y};
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

    function showDialogInfo(d, ev){

      $scope.this_node = d;

      $mdDialog.show({
          controller: node_info_ctrl,
          scope: $scope.$new(),
          templateUrl: 'dialogs/node_info.tmpl.html',
          parent: angular.element(document.body),
          clickOutsideToClose:true,
          targetEvent:ev
        })
 
      function node_info_ctrl(){
        d3.select(".node_dialog_image")
          .on("mousedown", function(){
            d3.select(this).transition().duration(500)
              .style("height", "200px")
          })
        $scope.closeInfo = function(){
          $mdDialog.cancel();
        }
      }
    }

    function addChild(d){

      // first expand any existing children
      if(d._children){
        d.children = d._children;
        d._children = null;
      }
      // If no children array creete it
      if(!d.children)d.children = [];
      let baby = {
        id:generateUUID(),
        name: d.name+"-child_"+d.children.length,
        image: "question.svg",
        question:"",
        answer:"",
        parent:d
      }
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

  function showSatelite(p,i){

    let satelites = {};
        satelites.nodes = [];
        satelites.links = [];

    let node_r = r*.5;
    
    if(p.satelites){
      satelites.nodes.push({id:'force_root', name:"", fixed:true, x:0, y:0, r:0});
      var positions = pointsOnCircle(p.satelites.length, r+30)

      i=1; //0 is force_root
      for(let s in p.satelites){
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
        if(d.name)showDialogInfo(d, d3.event)
      })

    node_force.append("path")
        .attr("id", function(d){
          return 'satelite_text_path_'+d.name.replaceAll(' ','_');
        })
        .attr("d", function(d){if(d.name)return getCurvePath(0.55);else return null})
        .attr("fill", "none")
        .attr("transform", "rotate(-90)");

    // add our text with embedded textPath and link the latter to the defined #curvedTextPath
    node_force.append("rect")  
        .attr("class", "node_background main")
        .style("visibility", function(d){if(d.id==='force_root')return 'hidden';else return 'visible';})
        .attr("x", function(d){return -d.r;})
        .attr("y", function(d){return -d.r;})
        .attr("width",  function(d){return (d.r*2);})
        .attr("height", function(d){return (d.r*2);})
        .attr("rx", node_r)
        .attr("ry", node_r)
        .style("fill", "#fff")

    // add our text with embedded textPath and link the latter to the defined #curvedTextPath
    node_force.append('text')
        .append('textPath')
        .attr("class", "curvedTextSatelite")
        .attr('startOffset', '50%')
        .attr('xlink:href', function(d){return '#satelite_text_path_'+d.name.replaceAll(' ','_')})
        .text(function(d){return d.name});

    node_force.append("svg:image")
        .attr("class", "image")
        .style("opacity", 1)
        .style("visibility", function(d){if(d.id==='force_root')return 'hidden';else return 'visible';})
        .attr("xlink:href", function(d){      
          if(d.image) return "images/tree/"+d.image
          else return null;
        })
        .attr("x", -(node_r/2))
        .attr("y", -(node_r/2))
        .attr("width", function(d){if(d.id==='force_root')return 0;else return node_r;})
        .attr("height", function(d){if(d.id==='force_root')return 0;else return node_r;})
        .attr("transform", "rotate(-90)")

    node_force.append('foreignObject')
        .attr("class", "text_box")
        .style("opacity", 0)
        .style("visibility", function(d){if(d.id==='force_root')return 'hidden';else return 'visible';})
        .attr("x", -(text_width/4))           
        .attr("y", -(node_r/2))
        .attr("width", (text_width/2))
        .attr("height", 20)
        .attr("transform", "rotate(-90)")
        .append('xhtml:div')
        .html(function(d){
          if(d.text){
            let html ="<div class='satelite_text'>"+d.text+"</div>";
            return html;
          }
        });

    if(p.name)d3.select("#"+p.name.replaceAll(' ','_')).moveToFront(); // Move the focused node to the front //

    function tick() {
      link_force.attr("x1", function(d) { return d.source.x; })
          .attr("y1", function(d) { return d.source.y; })
          .attr("x2", function(d) { return d.target.x; })
          .attr("y2", function(d) { return d.target.y; });

      //Moving <g> elements using transform attribute
      node_force.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

    }
  }

});

app.filter('capitalize', function() {
    return function(input) {
      return (!!input) ? input.charAt(0).toUpperCase() + input.substr(1).toLowerCase() : '';
    }
});

app.filter('orderObjectBy', function(){// Filter an object by an attribute (used for ordering a list after a search (specifically in the acocunts page))
   return function(input, attribute) {
      if (!angular.isObject(input)) return input;

      let array = [];
      for(let objectKey in input) {
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
    let d = new Date().getTime();
    let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = (d + Math.random()*16)%16 | 0;
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
  let points = [];
  for(let i = 0; i < amount; i++) {
    let x =  this_r * Math.cos(2 * Math.PI * i / amount);
    let y =  this_r * Math.sin(2 * Math.PI * i / amount);
    points.push({x:x.toFixed(2),y:y.toFixed(2)});
  }
  return points;
}
