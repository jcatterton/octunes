[string]$version = gc version.txt
[string]$chart_ref = "octunes"

[string]$context = kubectl config current-context
if ($context -ne "justin") {
    echo "Incorrect kubernetes context"
    Exit
}

$tag_regex = 'tag:\ [0-9]*\.[0-9]*\.[0-9]*'
$version_regex = 'version:\ [0-9]*\.[0-9]*\.[0-9]*'
$href_regex = '\"baseHref\": \".*\"'

echo "Updating to version $version"
npm version $version --allow-same-version --no-git-tag-version
(Get-Content ./$chart_ref/values.yaml) -replace $tag_regex, "tag: $version" | Out-File ./$chart_ref/values.yaml
(Get-Content ./$chart_ref/Chart.yaml) -replace $version_regex, "version: $version" | Out-File ./$chart_ref/Chart.yaml

docker build -f ./docker/Dockerfile -t "192.168.68.108:5000/octunes:$version" .
if (-Not $?) {
    echo "Error building docker image"
    Exit
}

docker push "192.168.68.108:5000/octunes:$version"
if (-Not $?) {
    echo "Error pushing docker image"
    Exit
}

helm upgrade -i $chart_ref ./$chart_ref
if (-Not $?) {
    echo "Error upgrading helm release"
    Exit
}

